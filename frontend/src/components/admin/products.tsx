"use client";

import { EyeOff, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/api/hooks";
import type { ProductSummary } from "@/lib/api/types";
import { useAdminCategories, useAdminProduct, useAdminProducts, useDeactivateProduct, useDeleteProduct } from "@/lib/admin/hooks";
import { isAdmin } from "@/lib/admin/nav";
import { formatPrice } from "@/lib/format";
import { JEWELLERY_TYPE_LABELS, METAL_LABELS } from "@/lib/labels";
import { ConfirmDialog, DataTable, PageHeader, Pagination, QueryState, SearchInput, type Column } from "./primitives";
import { ImagesPanel, ModelsPanel, TryOnAssetsPanel } from "./product-assets";
import { ProductForm } from "./product-form";

export function ProductsTable() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useSession();
  const { toast } = useToast();
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const status = params.get("status") ?? "all";
  const page = Number(params.get("page") ?? 1);
  const categories = useAdminCategories();
  const query = useAdminProducts({ q: q || undefined, category: category || undefined, include_inactive: true, page, page_size: 25, sort: "newest" });
  const deactivate = useDeactivateProduct();
  const remove = useDeleteProduct();
  const [confirm, setConfirm] = useState<{ action: "deactivate" | "delete"; product: ProductSummary } | null>(null);
  const set = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "" || v === 1 || v === "all") next.delete(k);
        else next.set(k, String(v));
      }
      router.replace(`?${next.toString()}` as never, { scroll: false });
    },
    [params, router],
  );

  const rows = (query.data?.items ?? []).filter((p) => (status === "active" ? p.in_stock || true : true));
  const columns: Column<ProductSummary>[] = [
    { key: "product", header: "Product", cell: (p) => (
      <span className="flex items-center gap-3">
        <span className="bg-bg-muted relative size-10 shrink-0 overflow-hidden rounded-sm">{p.primary_image && <Image src={p.primary_image.url} alt="" fill sizes="40px" className="object-cover" unoptimized />}</span>
        <span className="min-w-0"><span className="block truncate font-medium">{p.name}</span><span className="text-fg-muted block text-xs">{p.sku}</span></span>
      </span>
    ) },
    { key: "type", header: "Type", hideBelow: "md", cell: (p) => `${JEWELLERY_TYPE_LABELS[p.jewellery_type]} · ${METAL_LABELS[p.metal_type]}` },
    { key: "price", header: "Price", className: "text-right", cell: (p) => <span className="tabular-nums">{formatPrice(p.price)}</span> },
    { key: "flags", header: "Status", cell: (p) => (
      <span className="flex flex-wrap gap-1">
        {!p.in_stock && !p.is_made_to_order && <Badge tone="danger">Out of stock</Badge>}
        {p.tryon_enabled && <Badge tone="emerald">Try-on</Badge>}
        {p.has_3d && <Badge tone="neutral">3D</Badge>}
        {p.is_featured && <Badge tone="gold">Featured</Badge>}
      </span>
    ) },
    { key: "actions", header: <span className="sr-only">Actions</span>, className: "text-right", cell: (p) => (
      <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" aria-label={`Deactivate ${p.name}`} onClick={() => setConfirm({ action: "deactivate", product: p })}><EyeOff className="size-4" aria-hidden /></Button>
        {isAdmin(session.data?.user.roles) && <Button variant="ghost" size="icon" className="text-danger" aria-label={`Delete ${p.name}`} onClick={() => setConfirm({ action: "delete", product: p })}><Trash2 className="size-4" aria-hidden /></Button>}
      </span>
    ) },
  ];

  return (
    <>
      <PageHeader title="Products" description="The shop catalogue: pieces, variants, sizes and try-on assets." actions={<ButtonLink href="/admin/products/new" leftIcon={<Plus className="size-4" aria-hidden />}>New product</ButtonLink>} />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end">
        <SearchInput value={q} onChange={(v) => set({ q: v, page: undefined })} placeholder="Name or SKU" label="Search products" />
        <Select label="Category" wrapperClassName="md:w-56" value={category} onChange={(e) => set({ category: e.target.value, page: undefined })} options={[{ value: "", label: "All categories" }, ...(categories.data ?? []).map((c) => ({ value: c.slug, label: c.name }))]} />
      </div>
      <QueryState isPending={query.isPending} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <>
            <DataTable columns={columns} rows={rows} getKey={(p) => p.id} caption="Products" rowHref={(p) => `/admin/products/${p.id}`} empty={<EmptyState compact title="No products match" description="Try a different search, or add the first piece." action={<ButtonLink href="/admin/products/new">New product</ButtonLink>} />} />
            <Pagination page={query.data.page} pages={query.data.pages} total={query.data.total} onChange={(p) => set({ page: p })} />
          </>
        )}
      </QueryState>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.action === "delete" ? `Delete ${confirm.product.name}?` : `Hide ${confirm?.product.name ?? "this product"} from customers?`}
        description={confirm?.action === "delete" ? "Permanently removes the product and its files. Products that have been ordered cannot be deleted; deactivate them instead." : "The product stays in the catalogue for staff but disappears from the shop."}
        danger={confirm?.action === "delete"}
        confirmLabel={confirm?.action === "delete" ? "Delete" : "Deactivate"}
        loading={deactivate.isPending || remove.isPending}
        onConfirm={async () => {
          if (!confirm) return;
          try {
            if (confirm.action === "delete") await remove.mutateAsync(confirm.product.id);
            else await deactivate.mutateAsync(confirm.product.id);
            toast({ title: confirm.action === "delete" ? "Product deleted" : "Product deactivated", tone: "success" });
          } catch (error) {
            toast({ title: "That didn't work", description: errorMessage(error), tone: "error" });
          }
          setConfirm(null);
        }}
      />
    </>
  );
}

export function ProductEditor({ id }: { id: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const query = useAdminProduct(id);
  const tab = params.get("tab") ?? "details";
  return (
    <>
      <PageHeader backHref="/admin/products" backLabel="Products" title={query.data?.name ?? "Product"} description={query.data ? `${query.data.sku} · ${query.data.is_active ? "active" : "inactive"}` : undefined} actions={query.data && <ButtonLink href={`/products/${query.data.slug}` as never} variant="outline" size="sm">View in shop</ButtonLink>} />
      <QueryState isPending={query.isPending} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <Tabs value={tab} defaultValue="details" onValueChange={(v) => router.replace(`?tab=${v}` as never, { scroll: false })}>
            <TabList label="Product sections" className="mb-4">
              <Tab value="details">Details</Tab>
              <Tab value="assets">Images</Tab>
              <Tab value="tryon">Try-on assets</Tab>
              <Tab value="models">3D models</Tab>
            </TabList>
            <TabPanel value="details"><ProductForm product={query.data} /></TabPanel>
            <TabPanel value="assets"><ImagesPanel product={query.data} /></TabPanel>
            <TabPanel value="tryon"><TryOnAssetsPanel product={query.data} /></TabPanel>
            <TabPanel value="models"><ModelsPanel product={query.data} /></TabPanel>
          </Tabs>
        )}
      </QueryState>
    </>
  );
}
