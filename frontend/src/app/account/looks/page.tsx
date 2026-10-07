"use client";

import { Images } from "lucide-react";
import Link from "next/link";
import { AccountListPage } from "@/components/account/account-list-page";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

interface SavedLook {
  id: string;
  title: string;
  kind: string;
  share_token: string | null;
  created_at: string;
  item_count?: number;
}

export default function SavedLooksPage() {
  return (
    <AccountListPage<SavedLook>
      title="Saved looks"
      description="Every try-on result you chose to keep, including complete bridal looks."
      endpoint="/looks"
      queryKey="looks"
      icon={Images}
      emptyTitle="No saved looks yet"
      emptyDescription="Create a look in the try-on studio and save it to see it here."
      emptyAction={<ButtonLink href="/try-on">Open the try-on studio</ButtonLink>}
      getKey={(l) => l.id}
      renderItem={(l) => (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">{l.title}</p>
            <p className="text-fg-muted text-sm">
              {l.kind === "bridal" ? "Bridal look" : "Look"} · {formatDate(l.created_at)}
            </p>
          </div>
          {l.share_token && (
            <Link
              href={`/looks/${l.share_token}`}
              className="text-accent-text text-sm underline-offset-4 hover:underline"
            >
              View
            </Link>
          )}
        </div>
      )}
    />
  );
}
