"use client";

import { useState } from "react";
import { EnquiryFormCard, EnquirySuccess } from "./enquiry-form";
import { Dialog } from "@/components/ui/dialog";
import type { ProductSummary } from "@/lib/api/types";

/** "Ask About This Jewellery" dialog, pre-filled with the product. */
export function EnquiryDialog({
  product,
  open,
  onClose,
}: {
  product: ProductSummary;
  open: boolean;
  onClose: () => void;
}) {
  const [reference, setReference] = useState<string | null>(null);
  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
        setReference(null);
      }}
      title={reference ? "Enquiry sent" : `Ask about ${product.name}`}
      description={reference ? undefined : "A consultant will reply within one working day."}
    >
      {reference ? (
        <EnquirySuccess reference={reference} compact />
      ) : (
        <EnquiryFormCard
          compact
          context={{ productId: product.id, productSlug: product.slug }}
          initialMessage={`Hello, I'd like to know more about the ${product.name}. `}
          onSuccess={(e) => setReference(e.reference)}
        />
      )}
    </Dialog>
  );
}
