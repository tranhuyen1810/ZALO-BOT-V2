import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  port: number;
  companyName: string;
  zalo: {
    oaId: string;
    appId: string;
    appSecret: string;
  };
  telegram: {
    botToken: string;
    chatId: string;
  };
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 3000),
  companyName: process.env.COMPANY_NAME ?? "CÔNG TY CP XI MĂNG TIÊN SƠN HÀ TÂY",
  zalo: {
    oaId: process.env.ZALO_OA_ID ?? "",
    appId: process.env.ZALO_APP_ID ?? "",
    appSecret: process.env.ZALO_APP_SECRET ?? ""
  },
  telegram: {
    botToken: process.env.ADMIN_TELEGRAM_BOT_TOKEN ?? "",
    chatId: process.env.ADMIN_TELEGRAM_CHAT_ID ?? ""
  }
};
