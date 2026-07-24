import fs from "fs";
import path from "path";

const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");

export type SessionStep =
  | "IDLE"
  | "ORDER_PRODUCT"
  | "ORDER_QUANTITY"
  | "ORDER_UNIT"
  | "ORDER_PHONE"
  | "ORDER_ADDRESS"
  | "CREDIT_MENU"
  | "CREDIT_PHONE"
  | "TRACKING_ORDER_ID";

export interface SessionState {
  userId: string;
  userName: string;
  step: SessionStep;
  draft: Record<string, string | number>;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  allowedUnits: string[];
}

export interface DeliveryInfo {
  vehicleType: string;
  licensePlate: string;
  driverName: string;
  driverPhone: string;
  estimatedArrival: string;
}

export interface Order {
  orderId: string;
  customerZaloId: string;
  customerName: string;
  phone: string;
  product: string;
  quantity: number;
  unit: string;
  address: string;
  deliveryInfo: DeliveryInfo;
  status: "NEW" | "DELIVERING" | "DELIVERED";
  createdAt: string;
}

export interface CreditRequest {
  requestId: string;
  customerZaloId: string;
  customerName: string;
  phone: string;
  requestType: "DAI_LY_CONG_NO" | "CHINH_SACH_CONG_NO" | "GAP_CHUYEN_VIEN";
  notes: string;
  status: "PENDING_CALL" | "IN_PROGRESS" | "DONE";
  assignedTo: string;
  createdAt: string;
}

export class JsonStore {
  private sessions = new Map<string, SessionState>();

  getSession(userId: string, userName: string): SessionState {
    const existing = this.sessions.get(userId);
    if (existing) {
      return existing;
    }

    const initial: SessionState = {
      userId,
      userName,
      step: "IDLE",
      draft: {},
      updatedAt: new Date().toISOString()
    };

    this.sessions.set(userId, initial);
    return initial;
  }

  saveSession(session: SessionState): void {
    session.updatedAt = new Date().toISOString();
    this.sessions.set(session.userId, session);
  }

  readProducts(): Product[] {
    return this.readJson<Product[]>("products.json", []);
  }

  readOrders(): Order[] {
    return this.readJson<Order[]>("orders.json", []);
  }

  saveOrders(orders: Order[]): void {
    this.writeJson("orders.json", orders);
  }

  readCreditRequests(): CreditRequest[] {
    return this.readJson<CreditRequest[]>("credit_requests.json", []);
  }

  saveCreditRequests(requests: CreditRequest[]): void {
    this.writeJson("credit_requests.json", requests);
  }

  private readJson<T>(fileName: string, fallback: T): T {
    const filePath = path.join(dataDir, fileName);
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  }

  private writeJson(fileName: string, data: unknown): void {
    const filePath = path.join(dataDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  }
}
