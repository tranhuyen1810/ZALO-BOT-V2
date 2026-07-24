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
    expect(response.quickReplies?.length).toBe(3);
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
    handler.handle({ user: { id: "test-user-3", name: "Test" }, text: "tra cứu vận chuyển" });
    const response = handler.handle({ user: { id: "test-user-3", name: "Test" }, text: "TSHT-20260723-01" });

    expect(response.text).toContain("TSHT-20260723-01");
  });
});
