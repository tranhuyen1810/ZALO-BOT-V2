import fs from "fs";
import path from "path";
import TelegramBot, { type Message } from "node-telegram-bot-api";
import { config } from "../config";
import { MessageHandler } from "../zalo/handler";
import { ZaloIncomingMessage } from "../zalo/types";

export class TelegramAdapter {
  private bot: TelegramBot | null = null;
  private readonly handler = new MessageHandler();

  async start(): Promise<void> {
    const token = config.telegram.botToken?.trim();
    if (!token) {
      console.log("Telegram bot token chưa được cấu hình. Bỏ qua tích hợp Telegram.");
      return;
    }

    this.bot = new TelegramBot(token, { polling: true });

    this.bot.onText(/\/start/i, async (msg) => {
      await this.handleIncomingText(msg.chat.id, msg.from, "/start");
    });

    this.bot.onText(/\/help/i, async (msg) => {
      await this.handleIncomingText(msg.chat.id, msg.from, "/help");
    });

    this.bot.on("message", async (msg) => {
      const text = msg.text?.trim();
      if (!text || text.startsWith("/")) {
        return;
      }

      await this.handleIncomingText(msg.chat.id, msg.from, text);
    });

    this.bot.on("polling_error", (error) => {
      this.logError("telegram_polling_error", error);
      console.error("Telegram polling error:", error);
    });

    await this.bot.setMyCommands([
      { command: "start", description: "Bắt đầu trò chuyện với chatbot" },
      { command: "help", description: "Xem hướng dẫn sử dụng" }
    ]);

    const me = await this.bot.getMe();
    console.log(`Telegram bot is ready: @${me.username}`);
  }

  async stop(): Promise<void> {
    if (!this.bot) {
      return;
    }

    await this.bot.stopPolling();
  }

  private async handleIncomingText(chatId: number, from: Message["from"], text: string): Promise<void> {
    if (!this.bot) {
      return;
    }

    try {
      const userId = `telegram:${from?.id ?? chatId}`;
      const userName = from?.first_name || from?.username || `Telegram User ${chatId}`;
      const incoming: ZaloIncomingMessage = {
        user: { id: userId, name: userName },
        text
      };

      const response = this.handler.handle(incoming);
      const replyText = response.text || "Xin lỗi, hệ thống chưa có phản hồi phù hợp.";

      await this.bot.sendMessage(chatId, replyText, {
        parse_mode: "HTML"
      });

      if (response.quickReplies?.length) {
        const keyboard = response.quickReplies.map((item) => [{ text: item.title }]);
        await this.bot.sendMessage(chatId, "Bạn có thể chọn một tùy chọn dưới đây:", {
          reply_markup: {
            keyboard,
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
      }
    } catch (error) {
      this.logError("telegram_message_error", error);
      console.error("Telegram message handling failed:", error);
      await this.bot.sendMessage(chatId, "Đã xảy ra lỗi khi xử lý tin nhắn. Vui lòng thử lại sau.");
    }
  }

  private logError(context: string, error: unknown): void {
    const logDir = path.resolve(__dirname, "..", "..", "logs");
    const logFile = path.join(logDir, "telegram-errors.log");
    fs.mkdirSync(logDir, { recursive: true });
    const message = `${new Date().toISOString()} [${context}] ${error instanceof Error ? error.stack || error.message : String(error)}\n`;
    fs.appendFileSync(logFile, message, "utf-8");
  }
}
