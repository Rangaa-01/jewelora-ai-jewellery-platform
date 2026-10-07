"use client";

import { useMutation } from "@tanstack/react-query";
import { ScanSearch } from "lucide-react";
import { useState } from "react";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { FormError } from "@/components/forms/form-error";
import { ImageDropzone } from "@/components/forms/image-dropzone";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { api } from "@/lib/api/client";
import type { ProductSummary } from "@/lib/api/types";

interface VisualSearchResponse {
  exact: ProductSummary | null;
  similar: Array<{ product: ProductSummary; score: number }>;
}

export function VisualSearchView() {
  const [file, setFile] = useState<File | null>(null);
  const search = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("no file");
      const form = new FormData();
      form.append("image", file);
      return api.upload<VisualSearchResponse>("/visual-search", form);
    },
  });
  const results = search.data
    ? [
        ...(search.data.exact ? [search.data.exact] : []),
        ...search.data.similar.map((s) => s.product).filter((p) => p.id !== search.data?.exact?.id),
      ]
    : undefined;

  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container>
        <p className="eyebrow mb-2 inline-flex items-center gap-2">
          <ScanSearch className="size-4" aria-hidden /> Visual Search
        </p>
        <h1 className="text-4xl md:text-5xl">Find jewellery from a picture</h1>
        <p className="text-fg-muted mt-3 max-w-2xl">
          Upload a screenshot, catalogue photo or a picture of a piece you own. We compare it with
          our catalogue and show exact and similar matches with current prices.
        </p>
        <div className="mt-8 grid gap-8 lg:grid-cols-[22rem_1fr]">
          <div className="flex flex-col gap-4">
            <ImageDropzone
              file={file}
              onChange={(f) => {
                setFile(f);
                search.reset();
              }}
              label="Upload a jewellery image"
              hint="JPEG, PNG or WebP up to 12 MB. Crop to the jewellery for best results."
              capture="environment"
            />
            <FormError error={search.error} />
            <Button
              size="lg"
              onClick={() => search.mutate()}
              disabled={!file}
              loading={search.isPending}
              leftIcon={<ScanSearch className="size-5" aria-hidden />}
            >
              Search the catalogue
            </Button>
          </div>
          <div>
            {search.data?.exact && (
              <p className="border-emerald/40 bg-emerald-soft text-emerald-deep mb-4 rounded-sm border px-4 py-2 text-sm">
                We found an exact match in our catalogue — shown first.
              </p>
            )}
            {search.isPending || search.data ? (
              <ProductGrid
                products={results}
                loading={search.isPending}
                error={null}
                columns="2-3"
                skeletons={6}
                emptyTitle="No close matches"
                emptyDescription="We couldn't find similar pieces. Try a clearer, closer photo of the jewellery, or ask the AI stylist."
              />
            ) : (
              <div className="border-border-strong text-fg-muted flex min-h-64 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm">
                Matches appear here after you search.
              </div>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
