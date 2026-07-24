# ZALO-BOT-V2

Ứng dụng chatbot mô phỏng Zalo OA cho Công ty Cổ phần xi măng tiên Sơn Hà Tây, bám theo tài liệu đặc tả:

- `document/Tai_Lieu_Thiet_Ke_Zalo_Bot_Tiên_Sơn_Hà_Tây_v3.docx`

## Video giới thiệu tính năng và cách hoạt động

<video src="document/Thu%20Jul%2023%202026%2016_49_46.mp4" controls width="960"></video>

## 1. Mục tiêu

Dựa trên tài liệu đặc tả, hệ thống đã được phân tích, thiết kế và xây dựng hoàn chỉnh theo các nhóm chức năng:

- Đặt hàng nhanh.
- Tư vấn sỉ và chính sách công nợ.
- Theo dõi vận chuyển.
- Lưu dữ liệu thật bằng JSON file.
- Cung cấp giao diện web demo và kết nối Telegram Bot để kiểm thử luồng hội thoại.

## 2. Quy trình thực hiện

Đã triển khai theo quy trình:

1. Đọc tài liệu đặc tả đầy đủ.
2. Phân tích yêu cầu chức năng và phi chức năng.
3. Xác định kiến trúc, công nghệ, thư mục, schema dữ liệu, API, UI demo, business logic.
4. Lập kế hoạch và chia nhỏ module.
5. Triển khai từng module độc lập.
6. Thực hiện tự kiểm thử với test suite.
7. Build project.
8. Chạy project demo.
9. Rà lỗi và hiệu chỉnh đến khi ứng dụng chạy ổn định.

## 3. Kiến trúc hệ thống

### 3.1 Công nghệ

- Node.js + TypeScript
- Express
- JSON file store (database dạng file)
- Vitest (test)
- ESLint (lint)

### 3.2 Cấu trúc thư mục

```text
ZALO-BOT-V2/
├── src/
│   ├── index.ts
│   ├── config.ts
│   ├── store.ts
│   ├── zalo/
│   │   ├── client.ts
│   │   ├── handler.ts
│   │   └── types.ts
│   ├── services/
│   │   ├── orderService.ts
│   │   ├── creditConsultService.ts
│   │   └── trackingService.ts
│   ├── tests/
│   │   └── handler.test.ts
│   └── utils/
│       ├── format.ts
│       └── keyboard.ts
├── data/
│   ├── products.json
│   ├── orders.json
│   ├── credit_requests.json
│   └── topics.json
├── public/
│   ├── index.html
│   └── logo.jpg
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## 4. Database schema và kết nối

Hệ thống dùng file JSON trong thư mục `data/` như một database:

- `products.json`: danh mục sản phẩm.
- `orders.json`: đơn hàng + trạng thái vận chuyển.
- `credit_requests.json`: yêu cầu tư vấn sỉ/công nợ.
- `topics.json`: cấu hình chủ đề hội thoại.

Kết nối dữ liệu được thực hiện qua `src/store.ts`:

- Đọc/ghi file đồng bộ để đơn giản triển khai demo.
- Quản lý session hội thoại theo `userId` trong bộ nhớ.

## 5. API specifications

- `GET /health`: kiểm tra trạng thái server.
- `POST /webhook/zalo`: endpoint nhận webhook tin nhắn Zalo.
- `POST /api/chat/message`: endpoint chat demo nội bộ.
- `GET /`: giao diện chatbot demo.
- Telegram Bot: nhận tin nhắn từ Telegram, chuyển qua cùng lớp xử lý chatbot và trả lời đúng tài khoản người dùng.

Ví dụ payload chat demo:

```json
{
	"userId": "demo-user",
	"userName": "Khách Demo",
	"text": "menu"
}
```

## 6. UI/UX chatbot demo

- Header có logo công ty và tên doanh nghiệp.
- Khung chat hiển thị tin nhắn bot/user.
- Nút Quick Reply cho 3 luồng chính.
- Responsive cho desktop và mobile.

## 7. Business logic chính

### 7.1 Đặt hàng nhanh

Luồng xử lý: Chọn sản phẩm -> Số lượng -> Đơn vị -> SĐT -> Địa chỉ công trình -> Tạo mã đơn hàng tự động.

### 7.2 Tư vấn sỉ và công nợ

3 lựa chọn:

1. Đăng ký đại lý/mua sỉ công trình.
2. Tra cứu chính sách công nợ và chiết khấu.
3. Gặp chuyên viên kinh doanh.

Sau lựa chọn, bot thu thập SĐT và ghi nhận yêu cầu vào `credit_requests.json`.

### 7.3 Theo dõi vận chuyển

Bot nhận mã đơn hàng và trả về trạng thái cùng thông tin xe/tài xế. Người dùng có thể nhập `theo dõi vận chuyển` hoặc `tra cứu vận chuyển`.

## 8. Chạy demo thử (quan trọng)

### 8.0 Cấu hình Telegram Bot Token

1. Tạo bot trên Telegram bằng BotFather.
2. Sao chép token và lưu vào file `.env`:

```env
PORT=3000
COMPANY_NAME="CÔNG TY CP XI MĂNG TIÊN SƠN HÀ TÂY"
ADMIN_TELEGRAM_BOT_TOKEN=your_bot_token_here
ADMIN_TELEGRAM_CHAT_ID=-1001234567890
TELEGRAM_BOT_USERNAME=XiMangAIbot
```

3. Khởi động ứng dụng và tìm kiếm bot trên Telegram bằng username đã cấu hình.

### 8.1 Yêu cầu môi trường

- Node.js 20+ (khuyến nghị)
- npm

### 8.2 Cài đặt và chạy

```bash
npm install
cp .env.example .env
npm run lint
npm test
npm run build
npm run dev
```

Mở trình duyệt:

- `http://localhost:3000`

Đối với Telegram, sau khi bot khởi động, người dùng có thể:

1. Tìm bot bằng tên `@XiMangAIbot`.
2. Nhấn nút `Start`.
3. Gửi câu hỏi như `menu`, `đặt hàng`, `tư vấn`, `theo dõi vận chuyển`.
4. Nhận phản hồi tự động từ cùng lớp xử lý chatbot hiện tại.

### 8.3 Chạy ở chế độ production

```bash
npm run build
npm start
```

## 9. Kịch bản demo nhanh

1. Gõ `menu` để mở menu chính.
2. Chọn `📝 Đặt hàng`, nhập tên sản phẩm, số lượng, đơn vị, SĐT và địa chỉ công trình.
3. Gõ `menu` -> chọn `🤝 Tư vấn Sỉ & Công nợ` -> chọn 1/2/3 -> nhập SĐT.
4. Gõ `menu` -> chọn `🚚 Theo dõi vận chuyển` -> nhập mã `TSHT-20260723-01`.
5. Trên Telegram, gửi `/start`, sau đó đặt câu hỏi như `đặt hàng` hoặc `theo dõi vận chuyển`.

## 10. Quy tắc chất lượng đã áp dụng

- Không để TODO/FIXME.
- Không dùng pseudo-code.
- Code có thể build và chạy.
- Có test cơ bản cho luồng chính.
- Có lint để kiểm tra chuẩn mã nguồn.
