"use client";

import { MessageCircle } from "lucide-react";
import { AccountListPage } from "@/components/account/account-list-page";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

interface Enquiry {
  id: string;
  reference: string;
  message: string;
  status: string;
  created_at: string;
  product: { name: string } | null;
}

export default function EnquiriesPage() {
  return (
    <AccountListPage<Enquiry>
      title="Enquiries"
      description="Questions you've asked about jewellery and our replies."
      endpoint="/enquiries"
      queryKey="enquiries"
      icon={MessageCircle}
      emptyTitle="No enquiries yet"
      emptyDescription="Ask about any piece and a consultant will get back to you."
      emptyAction={<ButtonLink href="/enquire">Ask a question</ButtonLink>}
      getKey={(e) => e.id}
      renderItem={(e) => (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">{e.product?.name ?? "General enquiry"}</p>
            <Badge tone={e.status === "resolved" ? "emerald" : "gold"}>
              {e.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-fg-soft mt-2 line-clamp-2 text-sm">{e.message}</p>
          <p className="text-fg-muted mt-2 text-xs">
            Ref {e.reference} · {formatDate(e.created_at)}
          </p>
        </div>
      )}
    />
  );
}
