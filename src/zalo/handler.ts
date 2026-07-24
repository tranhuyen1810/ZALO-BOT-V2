import { CreditConsultService } from "../services/creditConsultService";
import { OrderService } from "../services/orderService";
import { TrackingService } from "../services/trackingService";
import { JsonStore } from "../store";
import { mainMenuButtons } from "../utils/keyboard";
import { normalizeInput } from "../utils/format";
import { BotMessage, ZaloIncomingMessage } from "./types";

export class MessageHandler {
  private readonly store = new JsonStore();
  private readonly orderService = new OrderService(this.store);
  private readonly creditService = new CreditConsultService(this.store);
  private readonly trackingService = new TrackingService(this.store);

  handle(message: ZaloIncomingMessage): BotMessage {
    const session = this.store.getSession(message.user.id, message.user.name);
    const normalized = normalizeInput(message.text);

    if (!normalized || ["start", "bắt đầu", "menu", "hi", "hello"].includes(normalized)) {
      session.step = "IDLE";
      session.draft = {};
      this.store.saveSession(session);
      return {
        text:
          "Chào mừng quý khách đến với Công ty CP Xi Măng Tiên Sơn Hà Tây! Vui lòng chọn dịch vụ bên dưới.",
        quickReplies: mainMenuButtons
      };
    }

    if (normalized.includes("đặt hàng") || normalized.includes("quick_order") || normalized === "1") {
      const response = this.orderService.startOrder(session);
      this.store.saveSession(session);
      return response;
    }

    if (
      normalized.includes("tư vấn") ||
      normalized.includes("công nợ") ||
      normalized.includes("wholesale_credit") ||
      normalized === "2"
    ) {
      const response = this.creditService.startConsultation(session);
      this.store.saveSession(session);
      return response;
    }

    if (normalized.includes("tra cứu") || normalized.includes("tracking") || normalized === "3") {
      session.step = "TRACKING_ORDER_ID";
      const response = this.trackingService.askOrderId();
      this.store.saveSession(session);
      return response;
    }

    if (
      [
        "ORDER_PRODUCT",
        "ORDER_QUANTITY",
        "ORDER_UNIT",
        "ORDER_PHONE",
        "ORDER_ADDRESS"
      ].includes(session.step)
    ) {
      const response = this.orderService.handleOrderStep(session, message.text);
      this.store.saveSession(session);
      return response;
    }

    if (["CREDIT_MENU", "CREDIT_PHONE"].includes(session.step)) {
      const response = this.creditService.handleCreditStep(session, message.text);
      this.store.saveSession(session);
      return response;
    }

    if (session.step === "TRACKING_ORDER_ID") {
      const response = this.trackingService.handleTracking(message.text);
      session.step = "IDLE";
      this.store.saveSession(session);
      return response;
    }

    return {
      text:
        "Mình chưa hiểu yêu cầu. Vui lòng nhập 'menu' để mở lại lựa chọn dịch vụ chính.",
      quickReplies: mainMenuButtons
    };
  }
}
