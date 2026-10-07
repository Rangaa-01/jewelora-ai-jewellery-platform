"use client";

import { useId } from "react";
import type { TimeseriesPoint } from "@/lib/api/types";

interface ChartProps {
  data: TimeseriesPoint[];
  label: string;
  color?: "gold" | "emerald";
  height?: number;
}

const COLORS = { gold: "var(--color-gold-deep)", emerald: "var(--color-emerald)" } as const;

function describe(data: TimeseriesPoint[]): string {
  if (data.length === 0) return "No data in this range.";
  const total = data.reduce((s, d) => s + d.count, 0);
  const peak = data.reduce((a, b) => (b.count > a.count ? b : a));
  return `${total} in total across ${data.length} days; peak ${peak.count} on ${peak.date}.`;
}

/** Lightweight SVG bar chart; one bar per day. */
export function BarChart({ data, label, color = "gold", height = 160 }: ChartProps) {
  const id = useId();
  const width = 600;
  const padX = 8;
  const padY = 16;
  const max = Math.max(1, ...data.map((d) => d.count));
  const slot = data.length ? (width - padX * 2) / data.length : 0;
  const barW = Math.max(2, slot * 0.6);
  if (data.length === 0) return <EmptyChart label={label} />;
  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`} className="h-auto w-full">
        <title id={`${id}-title`}>{label}</title>
        <desc id={`${id}-desc`}>{describe(data)}</desc>
        <line x1={padX} x2={width - padX} y1={height - padY} y2={height - padY} stroke="var(--border)" />
        {data.map((d, i) => {
          const h = ((height - padY * 2) * d.count) / max;
          const x = padX + i * slot + (slot - barW) / 2;
          return (
            <g key={d.date}>
              <rect x={x} y={height - padY - h} width={barW} height={h} rx={1.5} fill={COLORS[color]} opacity={0.85}>
                <title>{`${d.date}: ${d.count}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-fg-muted mt-1 flex justify-between text-[0.65rem]">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </figcaption>
    </figure>
  );
}

/** Lightweight SVG line chart with area fill. */
export function LineChart({ data, label, color = "emerald", height = 160 }: ChartProps) {
  const id = useId();
  const width = 600;
  const padX = 8;
  const padY = 16;
  if (data.length === 0) return <EmptyChart label={label} />;
  const max = Math.max(1, ...data.map((d) => d.count));
  const step = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = padX + i * step;
    const y = height - padY - ((height - padY * 2) * d.count) / max;
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${path} L${(points[points.length - 1]?.[0] ?? padX).toFixed(1)} ${height - padY} L${padX} ${height - padY} Z`;
  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`} className="h-auto w-full">
        <title id={`${id}-title`}>{label}</title>
        <desc id={`${id}-desc`}>{describe(data)}</desc>
        <line x1={padX} x2={width - padX} y1={height - padY} y2={height - padY} stroke="var(--border)" />
        <path d={area} fill={COLORS[color]} opacity={0.12} />
        <path d={path} fill="none" stroke={COLORS[color]} strokeWidth={2} strokeLinejoin="round" />
        {points.map(([x, y], i) => (
          <circle key={data[i]!.date} cx={x} cy={y} r={3} fill={COLORS[color]}>
            <title>{`${data[i]!.date}: ${data[i]!.count}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="text-fg-muted mt-1 flex justify-between text-[0.65rem]">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </figcaption>
    </figure>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="border-border-strong text-fg-muted flex h-32 items-center justify-center rounded-md border border-dashed text-sm">
      No {label.toLowerCase()} in this range yet.
    </div>
  );
}
