import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { config } from "./config";
import { MessageHandler } from "./zalo/handler";
import { ZaloClient } from "./zalo/client";
import { TelegramAdapter } from "./telegram/adapter";

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

app.get("/", (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(config.port, () => {
  console.log(`Zalo Bot server is running at http://localhost:${config.port}`);
  telegramAdapter.start().catch((error) => {
    console.error("Failed to start Telegram adapter:", error);
  });
});
