import TelegramBot from "node-telegram-bot-api";
import { BotMessage, QuickReplyButton } from "../zalo/types";
import { JsonStore, Order, SessionState, Product } from "../store";
import { mainMenuButtons } from "../utils/keyboard";
import { nowIso, normalizeInput } from "../utils/format";
import { config } from "../config";
import { AppLogger } from "../utils/logger";

const fallbackUnits = ["bao", "tấn", "kg", "khối", "viên", "mét"];

export class OrderService {
  private readonly logger = new AppLogger();

  constructor(private readonly store: JsonStore) {}

  startOrder(session: SessionState): BotMessage {
    session.step = "ORDER_PRODUCT";
    session.draft = { items: [] };

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
    const normalized = normalizeInput(text);

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
        quickReplies: this.getOrderActions()
      };
    }

    if (session.step === "ORDER_AFTER_ITEM") {
      if (this.isAction(normalized, ["thêm", "them", "add"])) {
        session.step = "ORDER_PRODUCT";
        return {
          text: "Vui lòng chọn sản phẩm tiếp theo:",
          quickReplies: this.store.readProducts().map((p) => ({ id: `product_${p.id}`, title: p.name }))
        };
      }

      if (this.isAction(normalized, ["sửa", "sua", "edit"])) {
        session.step = "ORDER_EDIT_ITEM";
        return {
          text: "Nhập số thứ tự sản phẩm cần sửa (1, 2, 3...).",
          quickReplies: []
        };
      }

      if (this.isAction(normalized, ["xóa", "xoa", "delete"])) {
        session.step = "ORDER_DELETE_ITEM";
        return {
          text: "Nhập số thứ tự sản phẩm cần xóa.",
          quickReplies: []
        };
      }

      if (this.isAction(normalized, ["ghi chú", "ghichu", "note"])) {
        session.step = "ORDER_NOTE";
        return { text: "Vui lòng nhập ghi chú cho đơn hàng (hoặc gõ 'bỏ qua' nếu không có)." };
      }

      if (this.isAction(normalized, ["liên hệ", "lien he", "nhập thông tin", "nhap thong tin", "contact"])) {
        session.step = "ORDER_PHONE";
        return { text: "Vui lòng nhập số điện thoại liên hệ." };
      }

      if (this.isAction(normalized, ["xác nhận", "xac nhan", "confirm"])) {
        session.step = "ORDER_CONFIRM";
        return {
          text: `${this.formatOrderSummary(session)}\n\nChọn 'Xác nhận đặt hàng' để hoàn thành hoặc 'Hủy đơn' để bỏ qua.`,
          quickReplies: [
            { id: "order_confirm", title: "Xác nhận đặt hàng" },
            { id: "order_cancel", title: "Hủy đơn" }
          ]
        };
      }

      return {
        text: "Bạn có thể chọn 'Thêm sản phẩm', 'Sửa sản phẩm', 'Xóa sản phẩm', 'Nhập ghi chú', hoặc 'Nhập thông tin liên hệ'.",
        quickReplies: this.getOrderActions()
      };
    }

    if (session.step === "ORDER_EDIT_ITEM") {
      const index = this.parseItemIndex(text);
      if (index === undefined) {
        return { text: "Số thứ tự không hợp lệ. Vui lòng nhập lại theo định dạng 1, 2, 3..." };
      }

      const items = this.getItems(session);
      if (!items[index - 1]) {
        return { text: "Số thứ tự không tồn tại trong đơn hàng hiện tại." };
      }

      session.draft.editIndex = index - 1;
      session.step = "ORDER_EDIT_ITEM_QUANTITY";
      return { text: `Bạn đang sửa sản phẩm ${index}: ${items[index - 1].product}. Nhập số lượng mới.` };
    }

    if (session.step === "ORDER_EDIT_ITEM_QUANTITY") {
      const quantity = Number(text.trim());
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return { text: "Số lượng mới không hợp lệ. Vui lòng nhập số lớn hơn 0." };
      }

      session.draft.editQuantity = quantity;
      session.step = "ORDER_EDIT_ITEM_UNIT";
      return { text: "Nhập đơn vị mới." };
    }

    if (session.step === "ORDER_EDIT_ITEM_UNIT") {
      const unit = normalizeInput(text);
      const items = this.getItems(session);
      const target = items[Number(session.draft.editIndex)] as { product: string; quantity: number; unit: string } | undefined;
      if (!target) {
        session.step = "ORDER_AFTER_ITEM";
        return { text: "Không thể cập nhật sản phẩm này. Vui lòng thử lại." };
      }

      const allowedUnits = this.getAllowedUnits({ draft: { product: target.product } } as SessionState);
      if (!allowedUnits.includes(unit)) {
        return { text: `Đơn vị không hợp lệ. Vui lòng chọn một trong: ${allowedUnits.join(", ")}.` };
      }

      target.quantity = Number(session.draft.editQuantity);
      target.unit = unit;
      delete session.draft.editIndex;
      delete session.draft.editQuantity;
      session.step = "ORDER_AFTER_ITEM";
      return {
        text: `Đã cập nhật ${target.product} thành ${target.quantity} ${target.unit}.`,
        quickReplies: this.getOrderActions()
      };
    }

    if (session.step === "ORDER_DELETE_ITEM") {
      const index = this.parseItemIndex(text);
      if (index === undefined) {
        return { text: "Số thứ tự không hợp lệ. Vui lòng nhập lại theo định dạng 1, 2, 3..." };
      }

      const items = this.getItems(session);
      if (!items[index - 1]) {
        return { text: "Số thứ tự không tồn tại trong đơn hàng hiện tại." };
      }

      items.splice(index - 1, 1);
      session.step = "ORDER_AFTER_ITEM";
      return {
        text: `Đã xóa sản phẩm ở vị trí ${index}.`,
        quickReplies: this.getOrderActions()
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
      session.step = "ORDER_NOTE";
      return {
        text: `${this.formatOrderSummary(session)}\n\nVui lòng nhập ghi chú cho đơn hàng (hoặc gõ 'bỏ qua' nếu không có).`
      };
    }

    if (session.step === "ORDER_NOTE") {
      const note = this.sanitizeNote(text);
      if (note.length > 0) {
        session.draft.note = note;
      }

      session.step = "ORDER_CONFIRM";
      return {
        text: `${this.formatOrderSummary(session)}\n\nChọn 'Xác nhận đặt hàng' để hoàn thành hoặc 'Hủy đơn' để bỏ qua.`,
        quickReplies: [
          { id: "order_confirm", title: "Xác nhận đặt hàng" },
          { id: "order_cancel", title: "Hủy đơn" }
        ]
      };
    }

    if (session.step === "ORDER_CONFIRM") {
      const normalizedConfirm = normalizeInput(text);
      if (normalizedConfirm.includes("xác nhận") || normalizedConfirm.includes("confirm") || normalizedConfirm === "1") {
        const order = this.createOrder(session);
        session.step = "IDLE";
        session.draft = {};

        return {
          text:
            `Đã tạo đơn hàng thành công: ${order.orderId}\n` +
            `Danh sách sản phẩm: ${order.product}\n` +
            `Địa chỉ: ${order.address}\n` +
            (order.notes ? `Ghi chú: ${order.notes}\n` : "") +
            "Phòng Kinh doanh sẽ liên hệ xác nhận trong ít phút.",
          quickReplies: mainMenuButtons
        };
      }

      if (normalizedConfirm.includes("hủy") || normalizedConfirm.includes("cancel") || normalizedConfirm === "2") {
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
    const product = this.matchProduct(String(session.draft.product || ""));
    return product?.allowedUnits.length ? product.allowedUnits : fallbackUnits;
  }

  private getOrderActions(): QuickReplyButton[] {
    return [
      { id: "add_more", title: "Thêm sản phẩm" },
      { id: "edit_item", title: "Sửa sản phẩm" },
      { id: "delete_item", title: "Xóa sản phẩm" },
      { id: "add_note", title: "Nhập ghi chú" },
      { id: "to_contact", title: "Nhập thông tin liên hệ" }
    ];
  }

  private formatOrderSummary(session: SessionState): string {
    const items = this.getItems(session);
    const lines = items.map((item, index) => `${index + 1}. ${item.product} - ${item.quantity} ${item.unit}`);
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const note = this.sanitizeNote(String(session.draft.note || ""));

    return (
      `Thông tin đơn hàng hiện tại:\n${lines.join("\n") || "(Chưa có sản phẩm)"}\nTổng số mặt hàng: ${items.length}\nTổng số lượng: ${totalQuantity}` +
      (session.draft.phone ? `\nSĐT: ${session.draft.phone}` : "") +
      (session.draft.address ? `\nĐịa chỉ: ${session.draft.address}` : "") +
      (note ? `\nGhi chú: ${note}` : "")
    );
  }

  private getItems(session: SessionState): Array<{ product: string; quantity: number; unit: string }> {
    const items = Array.isArray(session.draft.items) ? session.draft.items : [];
    return items as Array<{ product: string; quantity: number; unit: string }>;
  }

  private parseItemIndex(text: string): number | undefined {
    const value = Number(text.trim());
    if (!Number.isFinite(value) || value <= 0) {
      return undefined;
    }
    return value;
  }

  private isAction(source: string, actions: string[]): boolean {
    return actions.some((action) => source.includes(action));
  }

  private sanitizeNote(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 160);
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
    const items = this.getItems(session);
    const productDesc = items.map((i) => `${i.product} (${i.quantity} ${i.unit})`).join("; ");
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const notes = this.sanitizeNote(String(session.draft.note || ""));

    const order: Order = {
      orderId,
      customerZaloId: session.userId,
      customerName: session.userName,
      phone: String(session.draft.phone || ""),
      product: productDesc,
      quantity: totalQuantity,
      unit: items.length === 1 ? String(items[0].unit) : "nhiều",
      address: String(session.draft.address || ""),
      notes,
      items,
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
    this.notifyAdmin(order);
    this.logger.info("order_created", { orderId, userId: session.userId, itemCount: items.length, note: notes });
    return order;
  }

  createOrderFromPayload(payload: {
    userId: string;
    userName: string;
    items: Array<{ product: string; quantity: number; unit: string }>;
    phone: string;
    address: string;
    notes?: string;
  }): Order {
    const orders = this.store.readOrders();
    const next = orders.length + 1;
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const orderId = `TSHT-${datePart}-${String(next).padStart(2, "0")}`;

    const productDesc = payload.items.map((i) => `${i.product} (${i.quantity} ${i.unit})`).join("; ");
    const totalQuantity = payload.items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
    const notes = this.sanitizeNote(payload.notes || "");

    const order: Order = {
      orderId,
      customerZaloId: payload.userId,
      customerName: payload.userName,
      phone: String(payload.phone),
      product: productDesc,
      quantity: totalQuantity,
      unit: payload.items.length === 1 ? String(payload.items[0].unit) : "nhiều",
      address: String(payload.address),
      notes,
      items: payload.items,
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
    this.notifyAdmin(order);
    this.logger.info("order_created_web", { orderId, userId: payload.userId, itemCount: payload.items.length });
    return order;
  }

  private notifyAdmin(order: Order): void {
    const token = config.telegram.botToken?.trim() || "";
    const chatId = config.telegram.chatId?.trim() || "";

    if (!token || !chatId || token.includes("your_")) {
      this.logger.info("admin_notification_skipped", { orderId: order.orderId });
      return;
    }

    const bot = new TelegramBot(token, { polling: false });
    const message = [
      `Đơn hàng mới: ${order.orderId}`,
      `Khách: ${order.customerName}`,
      `SĐT: ${order.phone}`,
      `Địa chỉ: ${order.address}`,
      `Ghi chú: ${order.notes || "Không có"}`,
      `Chi tiết: ${order.product}`
    ].join("\n");

    bot.sendMessage(chatId, message).catch((error: unknown) => {
      this.logger.error("admin_notification_failed", error);
    });
  }
}
