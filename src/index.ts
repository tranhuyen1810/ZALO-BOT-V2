import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { config } from "./config";
import { MessageHandler } from "./zalo/handler";
import { ZaloClient } from "./zalo/client";
import { TelegramAdapter } from "./telegram/adapter";
import { JsonStore } from "./store";
import { OrderService } from "./services/orderService";
import TelegramBot from "node-telegram-bot-api";

const app = express();
const handler = new MessageHandler();
const zaloClient = new ZaloClient();
const telegramAdapter = new TelegramAdapter();

app.use(cors());
app.use(express.json());

const publicDir = path.resolve(__dirname, "..", "public");
const documentDir = path.resolve(__dirname, "..", "document");
app.use(express.static(publicDir));
app.use("/document", express.static(documentDir));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", company: config.companyName });
});

app.post("/webhook/zalo", (req: Request, res: Response) => {
  if (!zaloClient.verifyWebhook(req.body)) {
    res.status(400).json({ error: "invalid webhook payload" });
    return;
  }

  const incoming = zaloClient.parseIncomingMessage(req.body);
  const outgoing = handler.handle(incoming);
  res.json(zaloClient.formatOutgoing(outgoing));
});

app.post("/api/chat/message", (req: Request, res: Response) => {
  const { userId, userName, text } = req.body as {
    userId?: string;
    userName?: string;
    text?: string;
  };

  const response = handler.handle({
    user: {
      id: userId?.trim() || "demo-user",
      name: userName?.trim() || "Khách hàng Demo"
    },
    text: text?.trim() || ""
  });

  res.json(response);
});

app.get("/api/products", (_req: Request, res: Response) => {
  const store = new JsonStore();
  res.json(store.readProducts());
});

app.post("/api/order", (req: Request, res: Response) => {
  const { userId, userName, items, phone, address, notes } = req.body as {
    userId?: string;
    userName?: string;
    items?: Array<{ product: string; quantity: number; unit: string }>;
    phone?: string;
    address?: string;
    notes?: string;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "items required" });
    return;
  }

  const store = new JsonStore();
  const orderService = new OrderService(store);
  const order = orderService.createOrderFromPayload({
    userId: userId?.trim() || "web-user",
    userName: userName?.trim() || "Khách Web",
    items,
    phone: phone ?? "",
    address: address ?? "",
    notes: notes ?? ""
  });
  // Try to notify admin Telegram chat if token and chat id provided and token looks set
  try {
    const token = config.telegram.botToken || "";
    const chatId = config.telegram.chatId || "";
    if (token && !token.includes("your_") && chatId) {
      const bot = new TelegramBot(token, { polling: false });
      const msg = `Đơn hàng mới: ${order.orderId}\n${order.product}\nSĐT: ${order.phone}\nĐịa chỉ: ${order.address}`;
      bot.sendMessage(chatId, msg).catch(() => {});
    }
  } catch (err) {
    // ignore
  }

  res.json({
    text:
      `Đã tạo đơn hàng thành công: ${order.orderId}\nSản phẩm: ${order.product}\nĐịa chỉ: ${order.address}\n${order.notes ? `Ghi chú: ${order.notes}` : ""}`
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(config.port, () => {
  console.log(`Zalo Bot server is running at http://localhost:${config.port}`);
  telegramAdapter.start().catch((error) => {
    console.error("Failed to start Telegram adapter:", error);
  });
});
