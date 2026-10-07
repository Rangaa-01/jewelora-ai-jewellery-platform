"use client";

import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { useShareLook } from "@/lib/api/hooks";
import type { SavedLook } from "@/lib/api/types";
import { copyToClipboard, downloadImage, lookShareUrl, whatsappShareUrl } from "@/lib/shop/share";

/** Share, copy and download actions for a saved look (records a share on the backend). */
export function useLookActions() {
  const share = useShareLook();
  const { toast } = useToast();

  const shared = async (look: SavedLook, channel: string): Promise<string | null> => {
    try {
      const updated = await share.mutateAsync({ id: look.id, channel });
      return updated.share_url ?? (updated.share_token ? lookShareUrl(updated.share_token) : null);
    } catch (error) {
      toast({ title: "Couldn't share this look", description: errorMessage(error), tone: "error" });
      return null;
    }
  };

  return {
    pending: share.isPending,
    whatsapp: async (look: SavedLook) => {
      const url = await shared(look, "whatsapp");
      if (url)
        window.open(
          whatsappShareUrl(`Look what I tried on at Jewelora: ${look.title}`, url),
          "_blank",
          "noopener",
        );
    },
    copy: async (look: SavedLook) => {
      const url = await shared(look, "copy");
      if (!url) return;
      const ok = await copyToClipboard(url);
      toast({ title: ok ? "Link copied" : "Share link", description: url, tone: "success" });
    },
    download: async (look: SavedLook) => {
      if (!look.preview_url) {
        toast({
          title: "No image for this look yet",
          description: "Create it in the try-on studio to get a shareable picture.",
        });
        return;
      }
      await shared(look, "download");
      const ok = await downloadImage(
        look.preview_url,
        `jewelora-${look.title.replace(/\W+/g, "-").toLowerCase()}.webp`,
      );
      if (!ok) toast({ title: "Couldn't download the image", tone: "error" });
    },
  };
}
