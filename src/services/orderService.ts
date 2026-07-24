import { BotMessage } from "../zalo/types";
import { JsonStore, Order, SessionState } from "../store";
import { nowIso, normalizeInput } from "../utils/format";

const allowedUnits = ["bao", "tấn", "viên"];

export class OrderService {
  constructor(private readonly store: JsonStore) {}

  startOrder(session: SessionState): BotMessage {
    session.step = "ORDER_PRODUCT";
    session.draft = {};

    const products = this.store.readProducts().map((p) => `- ${p.name}`).join("\n");

    return {
      text:
        "Quý khách vui lòng chọn loại sản phẩm cần đặt:\n" +
        `${products}\n\n` +
        "Vui lòng nhập đúng tên sản phẩm."
    };
  }

  handleOrderStep(session: SessionState, text: string): BotMessage {
    if (session.step === "ORDER_PRODUCT") {
      const selected = this.matchProduct(text);
      if (!selected) {
        return { text: "Không tìm thấy sản phẩm phù hợp. Vui lòng nhập lại tên sản phẩm." };
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
      return { text: "Vui lòng nhập đơn vị: bao | tấn | viên." };
    }

    if (session.step === "ORDER_UNIT") {
      const unit = normalizeInput(text);
      if (!allowedUnits.includes(unit)) {
        return { text: "Đơn vị không hợp lệ. Vui lòng nhập một trong: bao, tấn, viên." };
      }

      session.draft.unit = unit;
      session.step = "ORDER_PHONE";
      return { text: "Vui lòng nhập số điện thoại liên hệ." };
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
      const order = this.createOrder(session);
      session.step = "IDLE";
      session.draft = {};

      return {
        text:
          `Đã tạo đơn hàng thành công: ${order.orderId}\n` +
          `Sản phẩm: ${order.product}\n` +
          `Số lượng: ${order.quantity} ${order.unit}\n` +
          `Địa chỉ: ${order.address}\n` +
          "Phòng Kinh doanh sẽ liên hệ xác nhận trong ít phút."
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
