export type UserIntent =
  | "START"
  | "QUICK_ORDER"
  | "WHOLESALE_CREDIT"
  | "TRACKING"
  | "UNKNOWN";

export interface ZaloUser {
  id: string;
  name: string;
}

export interface ZaloIncomingMessage {
  user: ZaloUser;
  text: string;
}

export interface QuickReplyButton {
  id: string;
  title: string;
}

export interface BotMessage {
  text: string;
  quickReplies?: QuickReplyButton[];
}
