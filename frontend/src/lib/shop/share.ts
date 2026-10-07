import { SITE_URL } from "@/lib/site";

/** Absolute URL for a shared look page. */
export function lookShareUrl(token: string, base: string = SITE_URL): string {
  return `${base.replace(/\/$/, "")}/looks/${encodeURIComponent(token)}`;
}

/** Absolute URL for a shared wishlist page. */
export function wishlistShareUrl(token: string, base: string = SITE_URL): string {
  return `${base.replace(/\/$/, "")}/wishlist/shared/${encodeURIComponent(token)}`;
}

/** WhatsApp "click to chat" link that pre-fills a message with the share URL. */
export function whatsappShareUrl(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`.trim())}`;
}

/** Copies text to the clipboard; resolves false when the Clipboard API is unavailable. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Downloads a remote image through a blob so cross-origin headers don't block saving. */
export async function downloadImage(url: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) return false;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    return true;
  } catch {
    return false;
  }
}
