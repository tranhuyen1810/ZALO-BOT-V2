import { QuickReplyButton } from "../zalo/types";

export const mainMenuButtons: QuickReplyButton[] = [
  { id: "price_lookup", title: "💲 Tra cứu bảng giá" },
  { id: "quick_order", title: "📝 Đặt hàng" },
  { id: "wholesale_credit", title: "🤝 Tư vấn Sỉ & Công nợ" },
  { id: "tracking", title: "🚚 Theo dõi vận chuyển" }
];

export const creditButtons: QuickReplyButton[] = [
  { id: "credit_register", title: "1. Đăng ký Đại lý / Mua sỉ công trình" },
  { id: "credit_policy", title: "2. Tra cứu chính sách công nợ & chiết khấu" },
  { id: "sales_specialist", title: "3. Gặp Chuyên viên Kinh doanh" }
];
