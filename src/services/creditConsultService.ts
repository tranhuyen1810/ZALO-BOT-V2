import { BotMessage } from "../zalo/types";
import { JsonStore, CreditRequest, SessionState } from "../store";
import { creditButtons } from "../utils/keyboard";
import { nowIso } from "../utils/format";

export class CreditConsultService {
  constructor(private readonly store: JsonStore) {}

  startConsultation(session: SessionState): BotMessage {
    session.step = "CREDIT_MENU";
    session.draft = {};

    return {
      text: "Quý khách cần hỗ trợ dịch vụ nào?",
      quickReplies: creditButtons
    };
  }

  handleCreditStep(session: SessionState, text: string): BotMessage {
    if (session.step === "CREDIT_MENU") {
      const normalized = text.toLowerCase();

      if (normalized.includes("đăng ký") || normalized.includes("mua sỉ") || normalized.includes("1")) {
        session.draft.requestType = "DAI_LY_CONG_NO";
        session.draft.notes = "Đăng ký đại lý hoặc mua sỉ công trình > 10 tấn";
        session.step = "CREDIT_PHONE";
        return { text: "Vui lòng nhập số điện thoại để chuyên viên kinh doanh gọi lại trong 5 phút." };
      }

      if (normalized.includes("chính sách") || normalized.includes("công nợ") || normalized.includes("2")) {
        session.draft.requestType = "CHINH_SACH_CONG_NO";
        session.draft.notes = "Tra cứu chính sách công nợ và chiết khấu";
        session.step = "CREDIT_PHONE";
        return {
          text:
            "Chính sách công nợ tham khảo: hỗ trợ hạn mức theo hồ sơ đại lý, chu kỳ đối soát 30 ngày, chiết khấu theo sản lượng.\n" +
            "Vui lòng nhập số điện thoại để chuyên viên phụ trách công nợ liên hệ."
        };
      }

      if (normalized.includes("chuyên viên") || normalized.includes("3")) {
        session.draft.requestType = "GAP_CHUYEN_VIEN";
        session.draft.notes = "Yêu cầu gặp chuyên viên kinh doanh";
        session.step = "CREDIT_PHONE";
        return { text: "Vui lòng nhập số điện thoại để chuyên viên kinh doanh liên hệ ngay." };
      }

      return {
        text:
          "Lựa chọn chưa hợp lệ. Vui lòng chọn lại:\n" +
          "1. Đăng ký Đại lý / Mua sỉ công trình\n" +
          "2. Tra cứu chính sách công nợ & chiết khấu\n" +
          "3. Gặp Chuyên viên Kinh doanh"
      };
    }

    if (session.step === "CREDIT_PHONE") {
      const phone = text.trim();
      if (!/^0\d{9,10}$/.test(phone)) {
        return { text: "SĐT không hợp lệ. Vui lòng nhập lại số điện thoại bắt đầu bằng 0." };
      }

      const request = this.createRequest(session, phone);
      session.step = "IDLE";
      session.draft = {};

      return {
        text:
          `Đã ghi nhận yêu cầu ${request.requestId}.\n` +
          `Chuyên viên phụ trách sẽ liên hệ qua số ${request.phone} trong 5 phút.`
      };
    }

    return { text: "Luồng tư vấn chưa được khởi tạo. Vui lòng bấm 🤝 Tư vấn Sỉ & Công nợ." };
  }

  private createRequest(session: SessionState, phone: string): CreditRequest {
    const requests = this.store.readCreditRequests();
    const next = requests.length + 1;
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const requestId = `CR-${datePart}-${String(next).padStart(2, "0")}`;

    const request: CreditRequest = {
      requestId,
      customerZaloId: session.userId,
      customerName: session.userName,
      phone,
      requestType: session.draft.requestType as CreditRequest["requestType"],
      notes: String(session.draft.notes ?? "Yêu cầu tư vấn"),
      status: "PENDING_CALL",
      assignedTo: "Phòng Kinh Doanh - Tiên Sơn Hà Tây",
      createdAt: nowIso()
    };

    requests.push(request);
    this.store.saveCreditRequests(requests);
    return request;
  }
}
