import { BotMessage } from "../zalo/types";
import { JsonStore } from "../store";
import { normalizeInput } from "../utils/format";

export class TrackingService {
  constructor(private readonly store: JsonStore) {}

  askOrderId(): BotMessage {
    return {
      text: "Vui lòng nhập mã đơn hàng cần theo dõi (ví dụ: TSHT-20260723-01)."
    };
  }

  handleTracking(orderIdInput: string): BotMessage {
    const orderId = orderIdInput.trim();
    const order = this.store
      .readOrders()
      .find((item) => normalizeInput(item.orderId) === normalizeInput(orderId));

    if (!order) {
      return {
        text: "Không tìm thấy đơn hàng. Vui lòng kiểm tra lại mã đơn và thử lại."
      };
    }

    return {
      text:
        `Đơn hàng ${order.orderId} đang ở trạng thái ${order.status}.\n` +
        `${order.deliveryInfo.vehicleType} ${order.deliveryInfo.licensePlate} - Tài xế ${order.deliveryInfo.driverName} (${order.deliveryInfo.driverPhone}).\n` +
        `Dự kiến đến: ${new Date(order.deliveryInfo.estimatedArrival).toLocaleString("vi-VN")}.`
    };
  }
}
