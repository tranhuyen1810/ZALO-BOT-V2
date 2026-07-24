import { BotMessage, ZaloIncomingMessage } from "./types";

export class ZaloClient {
  verifyWebhook(payload: unknown): boolean {
    return Boolean(payload);
  }

  parseIncomingMessage(payload: unknown): ZaloIncomingMessage {
    const body = payload as Record<string, unknown>;
    const user = body.user as Record<string, unknown> | undefined;

    return {
      user: {
        id: String(user?.id ?? "anonymous"),
        name: String(user?.name ?? "Khách hàng")
      },
      text: String(body.text ?? "")
    };
  }

  formatOutgoing(message: BotMessage): Record<string, unknown> {
    return {
      text: message.text,
      quickReplies: message.quickReplies ?? []
    };
  }
}
