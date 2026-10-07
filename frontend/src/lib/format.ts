const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const INR_PRECISE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats a price string/number (API sends decimals as strings) in Indian rupees. */
export function formatPrice(value: string | number, options: { precise?: boolean } = {}): string {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(amount)) return "—";
  return (options.precise ? INR_PRECISE : INR).format(amount);
}

/** Compact Indian notation for budgets: 1,50,000 → "₹1.5 L". */
export function formatPriceCompact(value: string | number): string {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(amount)) return "—";
  if (amount >= 1_00_00_000) return `₹${trimZero(amount / 1_00_00_000)} Cr`;
  if (amount >= 1_00_000) return `₹${trimZero(amount / 1_00_000)} L`;
  if (amount >= 1_000) return `₹${trimZero(amount / 1_000)}k`;
  return INR.format(amount);
}

function trimZero(n: number): string {
  return n.toFixed(n % 1 === 0 ? 0 : 1);
}

export function formatWeight(grams: string | number | null | undefined): string | null {
  if (grams === null || grams === undefined) return null;
  const n = typeof grams === "string" ? Number.parseFloat(grams) : grams;
  if (!Number.isFinite(n)) return null;
  return `${n.toFixed(n % 1 === 0 ? 0 : 2)} g`;
}

export function formatDate(value: string | Date, opts: Intl.DateTimeFormatOptions = {}): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", ...opts }).format(date);
}
