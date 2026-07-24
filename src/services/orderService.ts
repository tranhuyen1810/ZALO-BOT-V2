import { BotMessage } from "../zalo/types";
import { JsonStore, Order, SessionState } from "../store";
import { mainMenuButtons } from "../utils/keyboard";
import { nowIso, normalizeInput } from "../utils/format";

const allowedUnits = ["bao", "tấn", "viên"];

export class OrderService {
  constructor(private readonly store: JsonStore) {}

  startOrder(session: SessionState): BotMessage {
    session.step = "ORDER_PRODUCT";
    session.draft = {};

    const products = this.store.readProducts();
    const productList = products.map((p) => `- ${p.name}`).join("\n");
    const productButtons = products.map((product) => ({
      id: `product_${product.id}`,
      title: product.name
    }));

    return {
      text:
        "Quý khách vui lòng chọn loại sản phẩm cần đặt:\n" +
        `${productList}\n\n` +
        "Vui lòng chọn hoặc nhập tên sản phẩm.",
      quickReplies: productButtons
    };
  }

  handleOrderStep(session: SessionState, text: string): BotMessage {
    if (session.step === "ORDER_PRODUCT") {
      const selected = this.matchProduct(text);
      if (!selected) {
        const products = this.store.readProducts();
        return {
          text: "Không tìm thấy sản phẩm phù hợp. Vui lòng chọn lại hoặc nhập tên sản phẩm.",
          quickReplies: products.map((product) => ({
            id: `product_${product.id}`,
            title: product.name
          }))
        };
      }

      session.draft.product = selected.name;
      session.step = "ORDER_QUANTITY";
      return { text: "Vui lòng nhập số lượng (chỉ nhập số)." };
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
        quickReplies: allowedUnits.map((unit) => ({ id: `unit_${unit}`, title: unit }))
      };
    }

    if (session.step === "ORDER_UNIT") {
      const unit = normalizeInput(text);
      if (!allowedUnits.includes(unit)) {
        return { text: "Đơn vị không hợp lệ. Vui lòng nhập một trong: bao, tấn, viên." };
      }

      // add current item to draft.items
      session.draft.unit = unit;
      const item = {
        product: String(session.draft.product),
        quantity: Number(session.draft.quantity),
        unit: String(session.draft.unit)
      };

      if (!Array.isArray(session.draft.items)) {
        session.draft.items = [];
      }
      session.draft.items.push(item);

      session.step = "ORDER_AFTER_ITEM";
      return {
        text: "Đã thêm sản phẩm vào giỏ. Bạn muốn thêm sản phẩm khác hay tiếp tục đến thông tin liên hệ?",
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
        text:
          `Vui lòng kiểm tra lại thông tin đơn hàng và xác nhận:\n` +
          `Sản phẩm: ${session.draft.product}\n` +
          `Số lượng: ${session.draft.quantity} ${session.draft.unit}\n` +
          `SĐT: ${session.draft.phone}\n` +
          `Địa chỉ: ${session.draft.address}\n\n` +
          "Chọn 'Xác nhận đặt hàng' để hoàn thành hoặc 'Hủy đơn' để bỏ qua.",
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

  private matchProduct(input: string): { id: string; name: string } | undefined {
    const products = this.store.readProducts();
    const normalized = normalizeInput(input);

    return products.find((product) => normalizeInput(product.name).includes(normalized));
  }

  private createOrder(session: SessionState): Order {
    const orders = this.store.readOrders();
    const next = orders.length + 1;
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const orderId = `TSHT-${datePart}-${String(next).padStart(2, "0")}`;

    const order: Order = {
      orderId,
      customerZaloId: session.userId,
      customerName: session.userName,
      phone: String(session.draft.phone),
      product: String(session.draft.product),
      quantity: Number(session.draft.quantity),
      unit: String(session.draft.unit),
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
}
