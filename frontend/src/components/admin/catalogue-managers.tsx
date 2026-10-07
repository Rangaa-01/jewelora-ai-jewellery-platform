"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Pencil, Plus } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FormError } from "@/components/forms/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import type { AdminStore, Category, Collection } from "@/lib/api/types";
import { useAdminCategories, useAdminCollections, useAdminProducts, useAdminStores, useSaveCategory, useSaveCollection, useSaveStore, useUploadCollectionHero } from "@/lib/admin/hooks";
import { applyApiFieldErrors } from "@/lib/forms";
import { JEWELLERY_TYPE_LABELS } from "@/lib/labels";
import { Card, DataTable, PageHeader, QueryState, type Column } from "./primitives";

const slugField = z.string().trim().regex(/^([a-z0-9]+(?:-[a-z0-9]+)*)?$/, "lower-case letters, numbers and dashes");

// --- categories ---------------------------------------------------------------------------

const categorySchema = z.object({
  name: z.string().trim().min(2, "Name the category"),
  slug: slugField,
  description: z.string().trim().max(2000),
  parent_id: z.string(),
  jewellery_type: z.string(),
  sort_order: z.number({ error: "Enter a whole number" }).int(),
  is_active: z.boolean(),
});
type CategoryValues = z.infer<typeof categorySchema>;

function CategoryDialog({ open, onClose, category, categories }: { open: boolean; onClose: () => void; category: Category | null; categories: Category[] }) {
  const save = useSaveCategory();
  const { toast } = useToast();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    values: { name: category?.name ?? "", slug: category?.slug ?? "", description: category?.description ?? "", parent_id: category?.parent_id ?? "", jewellery_type: category?.jewellery_type ?? "", sort_order: category?.sort_order ?? 0, is_active: category?.is_active ?? true },
  });
  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ id: category?.id, input: { name: v.name, slug: v.slug || null, description: v.description || null, parent_id: v.parent_id || null, jewellery_type: (v.jewellery_type || null) as never, sort_order: v.sort_order, is_active: v.is_active } });
      toast({ title: category ? "Category saved" : "Category created", tone: "success" });
      onClose();
    } catch (error) {
      if (!applyApiFieldErrors(error, setError, ["name", "slug"])) toast({ title: "Couldn't save", description: errorMessage(error), tone: "error" });
    }
  });
  return (
    <Dialog open={open} onClose={onClose} title={category ? "Edit category" : "New category"} footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="category-form" loading={isSubmitting || save.isPending}>Save</Button></div>}>
      <form id="category-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input label="Name" required error={errors.name?.message} {...register("name")} />
        <Input label="Slug" hint="Blank = generated from the name." error={errors.slug?.message} {...register("slug")} />
        <Textarea label="Description" rows={3} {...register("description")} />
        <Select label="Parent category" options={[{ value: "", label: "None (top level)" }, ...categories.filter((c) => c.id !== category?.id).map((c) => ({ value: c.id, label: c.name }))]} {...register("parent_id")} />
        <Select label="Default jewellery type" hint="Pre-selects the try-on type for products in this category." options={[{ value: "", label: "None" }, ...Object.entries(JEWELLERY_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))]} {...register("jewellery_type")} />
        <Input label="Sort order" type="number" {...register("sort_order", { valueAsNumber: true })} />
        <Checkbox label="Active" {...register("is_active")} />
        <FormError error={save.error} />
      </form>
    </Dialog>
  );
}

export function CategoryManager() {
  const query = useAdminCategories();
  const [editing, setEditing] = useState<Category | null | "new">(null);
  const columns: Column<Category>[] = [
    { key: "name", header: "Category", cell: (c) => (<span>{c.parent_id && <span className="text-fg-muted">↳ </span>}<span className="font-medium">{c.name}</span><span className="text-fg-muted block text-xs">/{c.slug}</span></span>) },
    { key: "type", header: "Type", hideBelow: "md", cell: (c) => (c.jewellery_type ? JEWELLERY_TYPE_LABELS[c.jewellery_type as keyof typeof JEWELLERY_TYPE_LABELS] ?? c.jewellery_type : "—") },
    { key: "count", header: "Products", className: "text-right", cell: (c) => c.product_count },
    { key: "status", header: "Status", cell: (c) => <Badge tone={c.is_active ? "emerald" : "neutral"}>{c.is_active ? "Active" : "Hidden"}</Badge> },
    { key: "edit", header: <span className="sr-only">Edit</span>, className: "text-right", cell: (c) => <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil className="size-4" aria-hidden /></Button> },
  ];
  return (
    <>
      <PageHeader title="Categories" description="How the catalogue is organised for browsing." actions={<Button leftIcon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing("new")}>New category</Button>} />
      <QueryState isPending={query.isPending} error={query.error} onRetry={() => query.refetch()}>
        {query.data && <DataTable columns={columns} rows={query.data} getKey={(c) => c.id} caption="Categories" empty={<EmptyState compact title="No categories yet" action={<Button onClick={() => setEditing("new")}>New category</Button>} />} />}
      </QueryState>
      <CategoryDialog open={editing !== null} onClose={() => setEditing(null)} category={editing === "new" ? null : editing} categories={query.data ?? []} />
    </>
  );
}

// --- collections -----------------------------------------------------------------------------

const collectionSchema = z.object({
  name: z.string().trim().min(2, "Name the collection"),
  slug: slugField,
  tagline: z.string().trim().max(255),
  description: z.string().trim().max(5000),
  is_bridal: z.boolean(),
  is_featured: z.boolean(),
  sort_order: z.number({ error: "Enter a whole number" }).int(),
  is_active: z.boolean(),
  product_ids: z.array(z.string()),
});
type CollectionValues = z.infer<typeof collectionSchema>;

function CollectionDialog({ open, onClose, collection }: { open: boolean; onClose: () => void; collection: Collection | null }) {
  const save = useSaveCollection();
  const hero = useUploadCollectionHero();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const products = useAdminProducts({ q: q || undefined, collection: !q && collection ? collection.slug : undefined, page_size: 48 });
  const members = useAdminProducts({ collection: collection?.slug, page_size: 96 }, );
  const { register, handleSubmit, setError, control, setValue, formState: { errors, isSubmitting } } = useForm<CollectionValues>({
    resolver: zodResolver(collectionSchema),
    values: { name: collection?.name ?? "", slug: collection?.slug ?? "", tagline: collection?.tagline ?? "", description: collection?.description ?? "", is_bridal: collection?.is_bridal ?? false, is_featured: collection?.is_featured ?? false, sort_order: collection?.sort_order ?? 0, is_active: collection?.is_active ?? true, product_ids: members.data?.items.map((p) => p.id) ?? [] },
  });
  const chosen = useWatch({ control, name: "product_ids" });
  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ id: collection?.id, input: { ...v, slug: v.slug || null, tagline: v.tagline || null, description: v.description || null, product_ids: collection ? v.product_ids : v.product_ids.length ? v.product_ids : null } });
      toast({ title: collection ? "Collection saved" : "Collection created", tone: "success" });
      onClose();
    } catch (error) {
      if (!applyApiFieldErrors(error, setError, ["name", "slug"])) toast({ title: "Couldn't save", description: errorMessage(error), tone: "error" });
    }
  });
  return (
    <Dialog open={open} onClose={onClose} size="lg" title={collection ? "Edit collection" : "New collection"} footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="collection-form" loading={isSubmitting || save.isPending}>Save</Button></div>}>
      <form id="collection-form" onSubmit={onSubmit} noValidate className="grid gap-4 md:grid-cols-2">
        <Input label="Name" required error={errors.name?.message} {...register("name")} />
        <Input label="Slug" error={errors.slug?.message} {...register("slug")} />
        <Input label="Tagline" wrapperClassName="md:col-span-2" {...register("tagline")} />
        <Textarea label="Description" wrapperClassName="md:col-span-2" rows={3} {...register("description")} />
        <Input label="Sort order" type="number" {...register("sort_order", { valueAsNumber: true })} />
        <div className="flex flex-col justify-end">
          <Checkbox label="Bridal collection" {...register("is_bridal")} />
          <Checkbox label="Featured on the home page" {...register("is_featured")} />
          <Checkbox label="Active" {...register("is_active")} />
        </div>
        {collection && (
          <div className="md:col-span-2">
            <p className="text-fg-soft text-sm font-medium">Hero image</p>
            <div className="mt-1 flex items-center gap-3">
              <span className="bg-bg-muted relative h-16 w-28 overflow-hidden rounded-sm">{collection.hero_image_url && <Image src={collection.hero_image_url} alt="" fill sizes="112px" className="object-cover" unoptimized />}</span>
              <label className="touch-target border-border-strong hover:bg-bg-muted inline-flex cursor-pointer items-center gap-2 rounded-sm border px-3 text-sm">
                <ImagePlus className="size-4" aria-hidden /> {hero.isPending ? "Uploading…" : "Upload hero image"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { await hero.mutateAsync({ id: collection.id, file: f }); toast({ title: "Hero image updated", tone: "success" }); } catch (error) { toast({ title: "Upload failed", description: errorMessage(error), tone: "error" }); } }} />
              </label>
            </div>
          </div>
        )}
        <fieldset className="md:col-span-2">
          <legend className="text-fg-soft text-sm font-medium">Products in this collection ({chosen.length})</legend>
          <Input label="Find products" placeholder="Search by name or SKU" value={q} onChange={(e) => setQ(e.target.value)} wrapperClassName="mt-1" />
          <ul className="mt-2 grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
            {(products.data?.items ?? []).map((p) => (
              <li key={p.id}>
                <Checkbox label={<span>{p.name} <span className="text-fg-muted text-xs">{p.sku}</span></span>} checked={chosen.includes(p.id)} onChange={(e) => setValue("product_ids", e.target.checked ? [...chosen, p.id] : chosen.filter((id) => id !== p.id), { shouldDirty: true })} />
              </li>
            ))}
          </ul>
        </fieldset>
        <FormError error={save.error} className="md:col-span-2" />
      </form>
    </Dialog>
  );
}

export function CollectionManager() {
  const query = useAdminCollections();
  const [editing, setEditing] = useState<Collection | null | "new">(null);
  return (
    <>
      <PageHeader title="Collections" description="Curated edits shown on the home page and the collections hub." actions={<Button leftIcon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing("new")}>New collection</Button>} />
      <QueryState isPending={query.isPending} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (query.data.length === 0 ? (
          <EmptyState compact title="No collections yet" action={<Button onClick={() => setEditing("new")}>New collection</Button>} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {query.data.map((c) => (
              <li key={c.id} className="bg-bg-elevated border-border overflow-hidden rounded-lg border">
                <div className="bg-bg-muted relative aspect-[16/7]">{c.hero_image_url && <Image src={c.hero_image_url} alt="" fill sizes="(min-width:1280px) 33vw, 50vw" className="object-cover" unoptimized />}</div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div><h2 className="font-sans text-base font-semibold">{c.name}</h2><p className="text-fg-muted text-xs">{c.tagline ?? `/${c.slug}`}</p></div>
                    <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil className="size-4" aria-hidden /></Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1 text-xs">
                    <Badge tone="neutral">{c.product_count} products</Badge>
                    {c.is_featured && <Badge tone="gold">Featured</Badge>}
                    {c.is_bridal && <Badge tone="rose">Bridal</Badge>}
                    {!c.is_active && <Badge tone="danger">Hidden</Badge>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ))}
      </QueryState>
      {editing !== null && <CollectionDialog open onClose={() => setEditing(null)} collection={editing === "new" ? null : editing} />}
    </>
  );
}

// --- stores --------------------------------------------------------------------------------------

const storeSchema = z.object({
  name: z.string().trim().min(2, "Name the store"),
  slug: slugField,
  address_line1: z.string().trim().min(2, "Enter the address"),
  address_line2: z.string().trim(),
  city: z.string().trim().min(1, "Enter the city"),
  state: z.string().trim().min(1, "Enter the state"),
  postal_code: z.string().trim().min(3, "Enter the postal code"),
  country: z.string().trim().length(2, "2-letter code"),
  phone: z.string().trim(),
  email: z.string().trim(),
  timezone: z.string().trim().min(1),
  appointment_slot_minutes: z.number({ error: "Enter minutes" }).int().min(10).max(240),
  is_active: z.boolean(),
});
type StoreValues = z.infer<typeof storeSchema>;

function StoreDialog({ open, onClose, store }: { open: boolean; onClose: () => void; store: AdminStore | null }) {
  const save = useSaveStore();
  const { toast } = useToast();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<StoreValues>({
    resolver: zodResolver(storeSchema),
    values: { name: store?.name ?? "", slug: store?.slug ?? "", address_line1: store?.address_line1 ?? "", address_line2: store?.address_line2 ?? "", city: store?.city ?? "", state: store?.state ?? "", postal_code: store?.postal_code ?? "", country: store?.country ?? "IN", phone: store?.phone ?? "", email: store?.email ?? "", timezone: store?.timezone ?? "Asia/Kolkata", appointment_slot_minutes: store?.appointment_slot_minutes ?? 30, is_active: store?.is_active ?? true },
  });
  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ id: store?.id, input: { ...v, slug: v.slug || null, address_line2: v.address_line2 || null, phone: v.phone || null, email: v.email || null } });
      toast({ title: store ? "Store saved" : "Store created", tone: "success" });
      onClose();
    } catch (error) {
      if (!applyApiFieldErrors(error, setError, ["name", "slug", "email", "phone"])) toast({ title: "Couldn't save", description: errorMessage(error), tone: "error" });
    }
  });
  return (
    <Dialog open={open} onClose={onClose} size="lg" title={store ? "Edit store" : "New store"} footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="store-form" loading={isSubmitting || save.isPending}>Save</Button></div>}>
      <form id="store-form" onSubmit={onSubmit} noValidate className="grid gap-4 md:grid-cols-2">
        <Input label="Name" required error={errors.name?.message} {...register("name")} />
        <Input label="Slug" error={errors.slug?.message} {...register("slug")} />
        <Input label="Address line 1" required wrapperClassName="md:col-span-2" error={errors.address_line1?.message} {...register("address_line1")} />
        <Input label="Address line 2" wrapperClassName="md:col-span-2" {...register("address_line2")} />
        <Input label="City" required error={errors.city?.message} {...register("city")} />
        <Input label="State" required error={errors.state?.message} {...register("state")} />
        <Input label="Postal code" required error={errors.postal_code?.message} {...register("postal_code")} />
        <Input label="Country" required maxLength={2} error={errors.country?.message} {...register("country")} />
        <Input label="Phone" type="tel" error={errors.phone?.message} {...register("phone")} />
        <Input label="Email" type="email" hint="Receives appointment notifications." error={errors.email?.message} {...register("email")} />
        <Input label="Timezone" {...register("timezone")} />
        <Input label="Appointment slot (minutes)" type="number" min={10} max={240} error={errors.appointment_slot_minutes?.message} {...register("appointment_slot_minutes", { valueAsNumber: true })} />
        <Checkbox label="Active (bookable)" {...register("is_active")} />
        <FormError error={save.error} className="md:col-span-2" />
      </form>
    </Dialog>
  );
}

export function StoreManager() {
  const query = useAdminStores();
  const [editing, setEditing] = useState<AdminStore | null | "new">(null);
  return (
    <>
      <PageHeader title="Stores" description="Locations customers can book visits at." actions={<Button leftIcon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing("new")}>New store</Button>} />
      <QueryState isPending={query.isPending} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (query.data.length === 0 ? (
          <EmptyState compact title="No stores yet" action={<Button onClick={() => setEditing("new")}>New store</Button>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {query.data.map((s) => (
              <Card key={s.id} title={s.name} action={<Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Pencil className="size-4" aria-hidden /></Button>}>
                <p className="text-sm">{s.address_line1}{s.address_line2 && `, ${s.address_line2}`}</p>
                <p className="text-sm">{s.city}, {s.state} {s.postal_code}</p>
                <p className="text-fg-muted mt-2 text-xs">{s.phone ?? "No phone"} · {s.email ?? "No email"} · {s.appointment_slot_minutes}-minute slots</p>
                {!s.is_active && <Badge tone="danger" className="mt-2">Inactive</Badge>}
              </Card>
            ))}
          </div>
        ))}
      </QueryState>
      {editing !== null && <StoreDialog open onClose={() => setEditing(null)} store={editing === "new" ? null : editing} />}
    </>
  );
}
