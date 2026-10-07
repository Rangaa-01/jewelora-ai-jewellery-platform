import { render, screen } from "@testing-library/react";
import { Price } from "./price";
import { formatPrice, formatPriceCompact } from "@/lib/format";

describe("formatPrice", () => {
  it("formats rupees with Indian grouping", () => {
    expect(formatPrice("125000")).toBe("₹1,25,000");
    expect(formatPrice(1999.5, { precise: true })).toBe("₹1,999.50");
  });
  it("handles invalid input safely", () => {
    expect(formatPrice("abc")).toBe("—");
  });
  it("formats compact budgets", () => {
    expect(formatPriceCompact(200000)).toBe("₹2 L");
    expect(formatPriceCompact(150000)).toBe("₹1.5 L");
    expect(formatPriceCompact(45000)).toBe("₹45k");
  });
});

describe("Price", () => {
  it("shows strike-through base price and discount when discounted", () => {
    render(<Price price="90000" basePrice="100000" discountPercent="10" />);
    expect(screen.getByText("₹90,000")).toBeInTheDocument();
    expect(screen.getByText("₹1,00,000")).toBeInTheDocument();
    expect(screen.getByText("10% off")).toBeInTheDocument();
  });
  it("hides discount markup when there is none", () => {
    render(<Price price="90000" basePrice="90000" discountPercent="0" />);
    expect(screen.queryByText(/off/)).not.toBeInTheDocument();
  });
});
