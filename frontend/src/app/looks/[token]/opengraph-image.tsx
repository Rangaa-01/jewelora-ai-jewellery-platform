import { ImageResponse } from "next/og";
import type { PublicLook } from "@/lib/api/types";

export const alt = "A Jewelora look";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BACKEND = process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:8000";
const SITE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function fetchLook(token: string): Promise<PublicLook | null> {
  try {
    const response = await fetch(`${BACKEND}/api/v1/looks/shared/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as PublicLook;
  } catch {
    return null;
  }
}

/** Open Graph card for shared looks: the try-on preview when present, else a branded card. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const look = await fetchLook(token);
  const preview = look?.preview_url
    ? look.preview_url.startsWith("http")
      ? look.preview_url
      : `${SITE}${look.preview_url}`
    : null;
  const names =
    look?.items
      .map((i) => i.product.name)
      .slice(0, 3)
      .join(" · ") ?? "";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "linear-gradient(135deg, #faf7f2 0%, #efe6d6 100%)",
        color: "#1b1a17",
        fontFamily: "Georgia, serif",
      }}
    >
      {preview && (
        <img
          src={preview}
          alt=""
          width={504}
          height={630}
          style={{ objectFit: "cover", width: 504, height: 630 }}
        />
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 64,
          flex: 1,
        }}
      >
        <div
          style={{ fontSize: 28, letterSpacing: 6, textTransform: "uppercase", color: "#9c7a2a" }}
        >
          Jewelora
        </div>
        <div style={{ fontSize: 64, lineHeight: 1.1, marginTop: 24 }}>
          {look?.title ?? "A shared look"}
        </div>
        {names && <div style={{ fontSize: 26, marginTop: 24, color: "#5c574d" }}>{names}</div>}
        <div style={{ fontSize: 22, marginTop: 40, color: "#5c574d" }}>
          Created with virtual try-on · Try jewellery before you buy
        </div>
      </div>
    </div>,
    size,
  );
}
