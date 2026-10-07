import type { Order, OrderStatus } from "@/lib/api/types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Reserved",
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  confirmed: "Confirmed",
  ready_for_pickup: "Ready for pickup",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function orderTone(status: OrderStatus): "emerald" | "danger" | "gold" | "neutral" {
  if (status === "delivered" || status === "paid" || status === "ready_for_pickup")
    return "emerald";
  if (status === "cancelled" || status === "refunded") return "danger";
  if (status === "pending" || status === "awaiting_payment") return "gold";
  return "neutral";
}

export function canCancel(order: Order): boolean {
  return order.status === "pending" || order.status === "awaiting_payment";
}

/** Ordered milestones for the status timeline, depending on fulfilment. */
export function orderTimeline(order: Order): Array<{ status: OrderStatus; reached: boolean }> {
  const path: OrderStatus[] =
    order.fulfilment_method === "store_pickup"
      ? ["pending", "paid", "ready_for_pickup", "delivered"]
      : ["pending", "paid", "confirmed", "shipped", "delivered"];
  if (order.status === "cancelled" || order.status === "refunded") {
    return [
      { status: "pending", reached: true },
      { status: order.status, reached: true },
    ];
  }
  const index = Math.max(path.indexOf(order.status), order.paid_at ? 1 : 0);
  return path.map((status, i) => ({ status, reached: i <= index }));
}
