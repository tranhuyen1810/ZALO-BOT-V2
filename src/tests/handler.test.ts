import { describe, expect, it } from "vitest";
import { MessageHandler } from "../zalo/handler";

describe("MessageHandler", () => {
  it("returns main menu when user sends menu", () => {
    const handler = new MessageHandler();
    const response = handler.handle({
      user: { id: "test-user-1", name: "Test" },
      text: "menu"
    });

    expect(response.text).toContain("Chào mừng quý khách");
    expect(response.quickReplies?.length).toBe(4);
  });

  it("can start order flow", () => {
    const handler = new MessageHandler();
    const response = handler.handle({
      user: { id: "test-user-2", name: "Test" },
      text: "đặt hàng"
    });

    expect(response.text).toContain("vui lòng chọn loại sản phẩm");
  });

  it("can query tracking for sample order", () => {
    const handler = new MessageHandler();
    handler.handle({ user: { id: "test-user-3", name: "Test" }, text: "theo dõi vận chuyển" });
    const response = handler.handle({ user: { id: "test-user-3", name: "Test" }, text: "TSHT-20260723-01" });

    expect(response.text).toContain("TSHT-20260723-01");
  });

  it("shows price lookup when requested", () => {
    const handler = new MessageHandler();
    const response = handler.handle({ user: { id: "test-user-5", name: "Test" }, text: "tra cứu bảng giá" });

    expect(response.text).toContain("Bảng giá tham khảo");
  });

  it("can flow through multi-item order creation", () => {
    const handler = new MessageHandler();
    const user = { user: { id: "test-user-6", name: "Test" }, text: "đặt hàng" };
    let response = handler.handle(user);
    expect(response.text).toContain("vui lòng chọn loại sản phẩm");

    response = handler.handle({ user: user.user, text: "Xi Măng PCB30" });
    expect(response.text).toContain("Vui lòng nhập số lượng");

    response = handler.handle({ user: user.user, text: "10" });
    expect(response.text).toContain("Vui lòng chọn đơn vị");

    response = handler.handle({ user: user.user, text: "bao" });
    expect(response.text).toContain("Đã thêm: Xi Măng PCB30 Tiên Sơn Hà Tây - 10 bao.");

    response = handler.handle({ user: user.user, text: "nhập thông tin liên hệ" });
    expect(response.text).toContain("Vui lòng nhập số điện thoại liên hệ");

    response = handler.handle({ user: user.user, text: "0123456789" });
    expect(response.text).toContain("Vui lòng nhập địa chỉ");

    response = handler.handle({ user: user.user, text: "123 Đường A, Hà Nội" });
    expect(response.text).toContain("Thông tin đơn hàng hiện tại");

    response = handler.handle({ user: user.user, text: "xác nhận đặt hàng" });
    expect(response.text).toContain("Đã tạo đơn hàng thành công");
  });

  it("handles telegram-style commands", () => {
    const handler = new MessageHandler();
    const startResponse = handler.handle({ user: { id: "test-user-4", name: "Test" }, text: "/start" });
    const helpResponse = handler.handle({ user: { id: "test-user-4", name: "Test" }, text: "/help" });

    expect(startResponse.text).toContain("Chào mừng");
    expect(helpResponse.text).toContain("đặt hàng");
    expect(helpResponse.text).toContain("theo dõi vận chuyển");
  });
});
