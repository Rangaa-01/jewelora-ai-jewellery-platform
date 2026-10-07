import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PriceProps {
  price: string | number;
  basePrice?: string | number;
  discountPercent?: string | number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = { sm: "text-sm", md: "text-base", lg: "text-2xl" } as const;

export function Price({ price, basePrice, discountPercent, className, size = "md" }: PriceProps) {
  const discount = Number(discountPercent ?? 0);
  const showStrike = discount > 0 && basePrice !== undefined && Number(basePrice) > Number(price);
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2", sizes[size], className)}>
      <span className="text-fg font-semibold tabular-nums">{formatPrice(price)}</span>
      {showStrike && (
        <>
          <s
            className="text-fg-muted tabular-nums"
            aria-label={`Original price ${formatPrice(basePrice)}`}
          >
            {formatPrice(basePrice)}
          </s>
          <span className="text-emerald text-xs font-semibold">
            {discount % 1 === 0 ? discount : discount.toFixed(1)}% off
          </span>
        </>
      )}
    </span>
  );
}
