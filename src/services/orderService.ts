import { BotMessage } from "../zalo/types";
import { JsonStore, Order, SessionState, Product } from "../store";
import { mainMenuButtons } from "../utils/keyboard";
import { nowIso, normalizeInput } from "../utils/format";

const fallbackUnits = ["bao", "tấn", "viên"];

export class OrderService {
  constructor(private readonly store: JsonStore) {}

  startOrder(session: SessionState): BotMessage {
    session.step = "ORDER_PRODUCT";
    session.draft = {};

    const products = this.store.readProducts();
    return {
      text:
        "Quý khách vui lòng chọn loại sản phẩm cần đặt:\n" +
        products.map((p) => `- ${p.name}`).join("\n") +
        "\n\nVui lòng chọn hoặc nhập tên sản phẩm.",
      quickReplies: products.map((product) => ({ id: `product_${product.id}`, title: product.name }))
    };
  }

  handleOrderStep(session: SessionState, text: string): BotMessage {
    if (session.step === "ORDER_PRODUCT") {
      const selected = this.matchProduct(text);
      if (!selected) {
        const products = this.store.readProducts();
        return {
          text: "Không tìm thấy sản phẩm phù hợp. Vui lòng chọn lại hoặc nhập tên sản phẩm.",
          quickReplies: products.map((product) => ({ id: `product_${product.id}`, title: product.name }))
        };
      }

      session.draft.product = selected.name;
      session.step = "ORDER_QUANTITY";
      return { text: `Bạn đã chọn ${selected.name}. Vui lòng nhập số lượng (chỉ nhập số).` };
    }

    if (session.step === "ORDER_QUANTITY") {
      const quantity = Number(text.trim());
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return { text: "Số lượng không hợp lệ. Vui lòng nhập số lớn hơn 0." };
      }

      session.draft.quantity = quantity;
      session.step = "ORDER_UNIT";
      return {
        text: "Vui lòng chọn đơn vị:",
        quickReplies: this.getAllowedUnits(session).map((unit) => ({ id: `unit_${unit}`, title: unit }))
      };
    }

    if (session.step === "ORDER_UNIT") {
      const unit = normalizeInput(text);
      const allowedUnits = this.getAllowedUnits(session);
      if (!allowedUnits.includes(unit)) {
        return { text: `Đơn vị không hợp lệ. Vui lòng chọn một trong: ${allowedUnits.join(", ")}.` };
      }

      const item = {
        product: String(session.draft.product),
        quantity: Number(session.draft.quantity),
        unit
      };

      if (!Array.isArray(session.draft.items)) {
        session.draft.items = [];
      }
      session.draft.items.push(item);
      session.draft.product = undefined;
      session.draft.quantity = undefined;
      session.draft.unit = undefined;

      session.step = "ORDER_AFTER_ITEM";
      return {
        text:
          `Đã thêm: ${item.product} - ${item.quantity} ${item.unit}.\nHiện tại đơn hàng có ${session.draft.items.length} mục.`,
        quickReplies: [
          { id: "add_more", title: "Thêm sản phẩm" },
          { id: "to_contact", title: "Nhập thông tin liên hệ" }
        ]
      };
    }

    if (session.step === "ORDER_AFTER_ITEM") {
      const normalized = normalizeInput(text);
      if (normalized.includes("thêm") || normalized.includes("them") || normalized.includes("add") || normalized === "1") {
        session.step = "ORDER_PRODUCT";
        return {
          text: "Vui lòng chọn sản phẩm tiếp theo:",
          quickReplies: this.store.readProducts().map((p) => ({ id: `product_${p.id}`, title: p.name }))
        };
      }

      if (normalized.includes("liên hệ") || normalized.includes("nhập") || normalized.includes("tiếp") || normalized.includes("contact") || normalized === "2") {
        session.step = "ORDER_PHONE";
        return { text: "Vui lòng nhập số điện thoại liên hệ." };
      }

      return {
        text: "Vui lòng chọn 'Thêm sản phẩm' hoặc 'Nhập thông tin liên hệ'.",
        quickReplies: [
          { id: "add_more", title: "Thêm sản phẩm" },
          { id: "to_contact", title: "Nhập thông tin liên hệ" }
        ]
      };
    }

    if (session.step === "ORDER_PHONE") {
      const phone = text.trim();
      if (!/^0\d{9,10}$/.test(phone)) {
        return { text: "SĐT không hợp lệ. Vui lòng nhập số điện thoại Việt Nam bắt đầu bằng 0." };
      }

      session.draft.phone = phone;
      session.step = "ORDER_ADDRESS";
      return { text: "Vui lòng nhập địa chỉ công trình nhận hàng." };
    }

    if (session.step === "ORDER_ADDRESS") {
      const address = text.trim();
      if (address.length < 8) {
        return { text: "Địa chỉ quá ngắn. Vui lòng nhập đầy đủ địa chỉ công trình." };
      }

      session.draft.address = address;
      session.step = "ORDER_CONFIRM";
      return {
        text: `${this.formatOrderSummary(session)}\nChọn 'Xác nhận đặt hàng' để hoàn thành hoặc 'Hủy đơn' để bỏ qua.`,
        quickReplies: [
          { id: "order_confirm", title: "Xác nhận đặt hàng" },
          { id: "order_cancel", title: "Hủy đơn" }
        ]
      };
    }

    if (session.step === "ORDER_CONFIRM") {
      const normalized = normalizeInput(text);
      if (normalized.includes("xác nhận") || normalized.includes("confirm") || normalized === "1") {
        const order = this.createOrder(session);
        session.step = "IDLE";
        session.draft = {};

        return {
          text:
            `Đã tạo đơn hàng thành công: ${order.orderId}\n` +
            `Sản phẩm: ${order.product}\n` +
            `Số lượng: ${order.quantity} ${order.unit}\n` +
            `Địa chỉ: ${order.address}\n` +
            "Phòng Kinh doanh sẽ liên hệ xác nhận trong ít phút.",
          quickReplies: mainMenuButtons
        };
      }

      if (normalized.includes("hủy") || normalized.includes("cancel") || normalized === "2") {
        session.step = "IDLE";
        session.draft = {};
        return { text: "Đã hủy đơn hàng. Vui lòng chọn dịch vụ khác.", quickReplies: mainMenuButtons };
      }

      return {
        text: "Vui lòng chọn Xác nhận đặt hàng hoặc Hủy đơn.",
        quickReplies: [
          { id: "order_confirm", title: "Xác nhận đặt hàng" },
          { id: "order_cancel", title: "Hủy đơn" }
        ]
      };
    }

    return { text: "Luồng đặt hàng chưa được khởi tạo. Vui lòng bấm 📝 Đặt hàng." };
  }

  private getAllowedUnits(session: SessionState): string[] {
    const product = this.matchProduct(String(session.draft.product));
    return product?.allowedUnits.length ? product.allowedUnits : fallbackUnits;
  }

  private formatOrderSummary(session: SessionState): string {
    const items = Array.isArray(session.draft.items) ? session.draft.items : [];
    const lines = items.map((item, index) => `${index + 1}. ${item.product} - ${item.quantity} ${item.unit}`);
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    return (
      `Thông tin đơn hàng hiện tại:\n${lines.join("\n")}\nTổng số mặt hàng: ${items.length}\nTổng số lượng: ${totalQuantity}` +
      (session.draft.phone ? `\nSĐT: ${session.draft.phone}` : "") +
      (session.draft.address ? `\nĐịa chỉ: ${session.draft.address}` : "")
    );
  }

  private matchProduct(input: string): Product | undefined {
    const products = this.store.readProducts();
    const normalized = normalizeInput(input);

    return products.find((product) => normalizeInput(product.name).includes(normalized));
  }

  private createOrder(session: SessionState): Order {
    const orders = this.store.readOrders();
    const next = orders.length + 1;
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const orderId = `TSHT-${datePart}-${String(next).padStart(2, "0")}`;
    const items = Array.isArray(session.draft.items) ? session.draft.items : [];
    const productDesc = items.map((i) => `${i.product} (${i.quantity} ${i.unit})`).join("; ");
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    const order: Order = {
      orderId,
      customerZaloId: session.userId,
      customerName: session.userName,
      phone: String(session.draft.phone),
      product: productDesc,
      quantity: totalQuantity,
      unit: items.length === 1 ? String(items[0].unit) : "nhiều",
      address: String(session.draft.address),
      deliveryInfo: {
        vehicleType: "Xe cẩu",
        licensePlate: "29C-123.45",
        driverName: "Nguyễn Văn B",
        driverPhone: "0912345678",
        estimatedArrival: nowIso()
      },
      status: "NEW",
      createdAt: nowIso()
    };

    orders.push(order);
    this.store.saveOrders(orders);
    return order;
  }

  createOrderFromPayload(payload: {
    userId: string;
    userName: string;
    items: Array<{ product: string; quantity: number; unit: string }>;
    phone: string;
    address: string;
  }): Order {
    const orders = this.store.readOrders();
    const next = orders.length + 1;
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const orderId = `TSHT-${datePart}-${String(next).padStart(2, "0")}`;

    const productDesc = payload.items.map((i) => `${i.product} (${i.quantity} ${i.unit})`).join("; ");
    const totalQuantity = payload.items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);

    const order: Order = {
      orderId,
      customerZaloId: payload.userId,
      customerName: payload.userName,
      phone: String(payload.phone),
      product: productDesc,
      quantity: totalQuantity,
      unit: payload.items.length === 1 ? String(payload.items[0].unit) : "nhiều",
      address: String(payload.address),
      deliveryInfo: {
        vehicleType: "Xe cẩu",
        licensePlate: "29C-123.45",
        driverName: "Nguyễn Văn B",
        driverPhone: "0912345678",
        estimatedArrival: nowIso()
      },
      status: "NEW",
      createdAt: nowIso()
    };

    orders.push(order);
    this.store.saveOrders(orders);
    return order;
  }
}
