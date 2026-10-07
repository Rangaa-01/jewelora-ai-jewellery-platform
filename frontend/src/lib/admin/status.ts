import type { AppointmentStatus, EnquiryStatus, OrderStatus } from "@/lib/api/types";

type Tone = "gold" | "emerald" | "neutral" | "rose" | "danger" | "inverse";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "awaiting_payment",
  "paid",
  "confirmed",
  "ready_for_pickup",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "gold" },
  awaiting_payment: { label: "Awaiting payment", tone: "gold" },
  paid: { label: "Paid", tone: "emerald" },
  confirmed: { label: "Confirmed", tone: "emerald" },
  ready_for_pickup: { label: "Ready for pickup", tone: "emerald" },
  shipped: { label: "Shipped", tone: "inverse" },
  delivered: { label: "Delivered", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
  refunded: { label: "Refunded", tone: "danger" },
};

/** Sensible next steps per status; staff can still pick any status from the full list. */
export const ORDER_NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  awaiting_payment: ["paid", "cancelled"],
  paid: ["confirmed", "refunded"],
  confirmed: ["ready_for_pickup", "shipped", "cancelled"],
  ready_for_pickup: ["delivered", "cancelled"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export const ENQUIRY_STATUSES: readonly EnquiryStatus[] = ["new", "in_progress", "resolved", "closed"];
export const ENQUIRY_STATUS_META: Record<EnquiryStatus, { label: string; tone: Tone }> = {
  new: { label: "New", tone: "gold" },
  in_progress: { label: "In progress", tone: "inverse" },
  resolved: { label: "Resolved", tone: "emerald" },
  closed: { label: "Closed", tone: "neutral" },
};

export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  "requested",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];
export const APPOINTMENT_STATUS_META: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  requested: { label: "Requested", tone: "gold" },
  confirmed: { label: "Confirmed", tone: "emerald" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
  no_show: { label: "No show", tone: "danger" },
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pay_at_store: "Pay at store",
  razorpay: "Online (Razorpay)",
  bank_transfer: "Bank transfer",
};
