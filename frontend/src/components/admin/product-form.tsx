"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { ProductDetail, ProductInput, ProductSummary } from "@/lib/api/types";
import { useAdminCategories, useAdminCollections, useAdminProducts, useCreateProduct, useUpdateProduct } from "@/lib/admin/hooks";
import { applyApiFieldErrors } from "@/lib/forms";
import { JEWELLERY_TYPE_LABELS, METAL_LABELS, STONE_LABELS } from "@/lib/labels";
import { Card } from "./primitives";

const decimal = (label: string) =>
  z.string().trim().refine((v) => v === "" || /^-?\d+(\.\d{1,3})?$/.test(v), `${label} must be a number`);

const variantSchema = z.object({
  id: z.string().optional(),
  sku_suffix: z.string().trim().min(1, "Required").max(32),
  metal_type: z.enum(["gold", "white_gold", "rose_gold", "platinum", "silver"]),
  stone_type: z.enum(["none", "diamond", "ruby", "emerald", "sapphire", "pearl", "polki", "kundan", "cz"]),
  purity: z.string().trim().max(16),
  price_delta: decimal("Price delta"),
  stock_quantity: z.number({ error: "Enter a whole number" }).int().min(0),
  tint_hex: z.string().trim().regex(/^(#[0-9a-fA-F]{6})?$/, "Use #RRGGBB"),
  is_default: z.boolean(),
  is_active: z.boolean(),
});

const sizeSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, "Required").max(32),
  measurement_mm: decimal("Measurement"),
  price_delta: decimal("Price delta"),
  stock_quantity: z.number({ error: "Enter a whole number" }).int().min(0),
  is_default: z.boolean(),
});

const schema = z.object({
  sku: z.string().trim().min(2, "At least 2 characters").regex(/^[A-Za-z0-9\-_.]+$/, "Letters, numbers, - _ . only"),
  name: z.string().trim().min(2, "Give the piece a name"),
  slug: z.string().trim().regex(/^([a-z0-9]+(?:-[a-z0-9]+)*)?$/, "lower-case letters, numbers and dashes"),
  short_description: z.string().trim().max(300),
  description: z.string().trim().max(10000),
  category_id: z.string().min(1, "Choose a category"),
  jewellery_type: z.enum(["necklace", "chain", "pendant", "haram", "choker", "earrings", "ring", "bangle", "bracelet", "nose_ring", "maang_tikka", "waist_chain", "anklet", "set"]),
  metal_type: z.enum(["gold", "white_gold", "rose_gold", "platinum", "silver"]),
  purity: z.string().trim().max(16),
  stone_type: z.enum(["none", "diamond", "ruby", "emerald", "sapphire", "pearl", "polki", "kundan", "cz"]),
  gross_weight_g: decimal("Gross weight"),
  net_weight_g: decimal("Net weight"),
  stone_weight_ct: decimal("Stone weight"),
  making_charges: decimal("Making charges"),
  base_price: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter the price in rupees"),
  discount_percent: z.string().trim().regex(/^(\d{1,2}(\.\d{1,2})?|100)?$/, "0–100"),
  stock_quantity: z.number({ error: "Enter a whole number" }).int().min(0),
  is_made_to_order: z.boolean(),
  gender: z.enum(["women", "men", "unisex", "kids"]),
  occasions: z.string(),
  tags: z.string(),
  style: z.string().trim().max(40),
  tryon_enabled: z.boolean(),
  is_featured: z.boolean(),
  is_new: z.boolean(),
  is_active: z.boolean(),
  collection_ids: z.array(z.string()),
  set_item_ids: z.array(z.string()),
  variants: z.array(variantSchema),
  sizes: z.array(sizeSchema),
});
type Values = z.infer<typeof schema>;

const list = (s: string) => s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

function toInput(v: Values): ProductInput {
  return {
    sku: v.sku,
    name: v.name,
    slug: v.slug || null,
    short_description: v.short_description || null,
    description: v.description || null,
    category_id: v.category_id,
    jewellery_type: v.jewellery_type,
    metal_type: v.metal_type,
    purity: v.purity || null,
    stone_type: v.stone_type,
    gross_weight_g: v.gross_weight_g || null,
    net_weight_g: v.net_weight_g || null,
    stone_weight_ct: v.stone_weight_ct || null,
    making_charges: v.making_charges || "0",
    base_price: v.base_price,
    discount_percent: v.discount_percent || "0",
    stock_quantity: v.stock_quantity,
    is_made_to_order: v.is_made_to_order,
    gender: v.gender,
    occasions: list(v.occasions),
    tags: list(v.tags),
    style: v.style || null,
    tryon_enabled: v.tryon_enabled,
    is_featured: v.is_featured,
    is_new: v.is_new,
    is_active: v.is_active,
    collection_ids: v.collection_ids,
    set_item_ids: v.set_item_ids,
    variants: v.variants.map((x, i) => ({ ...x, id: x.id || undefined, purity: x.purity || null, price_delta: x.price_delta || "0", tint_hex: x.tint_hex || null, sort_order: i })),
    sizes: v.sizes.map((x, i) => ({ ...x, id: x.id || undefined, measurement_mm: x.measurement_mm || null, price_delta: x.price_delta || "0", sort_order: i })),
  };
}

function fromProduct(p: ProductDetail | undefined): Values {
  return {
    sku: p?.sku ?? "",
    name: p?.name ?? "",
    slug: p?.slug ?? "",
    short_description: p?.short_description ?? "",
    description: p?.description ?? "",
    category_id: p?.category.id ?? "",
    jewellery_type: p?.jewellery_type ?? "necklace",
    metal_type: p?.metal_type ?? "gold",
    purity: p?.purity ?? "22K",
    stone_type: p?.stone_type ?? "none",
    gross_weight_g: p?.gross_weight_g ?? "",
    net_weight_g: p?.net_weight_g ?? "",
    stone_weight_ct: p?.stone_weight_ct ?? "",
    making_charges: p?.making_charges ?? "",
    base_price: p?.base_price ?? "",
    discount_percent: p?.discount_percent ?? "",
    stock_quantity: p?.stock_quantity ?? 0,
    is_made_to_order: p?.is_made_to_order ?? false,
    gender: p?.gender ?? "women",
    occasions: p?.occasions.join(", ") ?? "",
    tags: p?.tags.join(", ") ?? "",
    style: p?.style ?? "",
    tryon_enabled: p?.tryon_enabled ?? false,
    is_featured: p?.is_featured ?? false,
    is_new: p?.is_new ?? false,
    is_active: p?.is_active ?? true,
    collection_ids: p?.collections.map((c) => c.id) ?? [],
    set_item_ids: p?.set_items.map((s) => s.product.id) ?? [],
    variants: p?.variants.map((v) => ({ id: v.id, sku_suffix: v.sku_suffix, metal_type: v.metal_type, stone_type: v.stone_type, purity: v.purity ?? "", price_delta: v.price_delta, stock_quantity: v.stock_quantity, tint_hex: v.tint_hex ?? "", is_default: v.is_default, is_active: v.is_active })) ?? [],
    sizes: p?.sizes.map((s) => ({ id: s.id, label: s.label, measurement_mm: s.measurement_mm ?? "", price_delta: s.price_delta, stock_quantity: s.stock_quantity, is_default: s.is_default })) ?? [],
  };
}

const metalOptions = (Object.keys(METAL_LABELS) as Array<keyof typeof METAL_LABELS>).map((k) => ({ value: k, label: METAL_LABELS[k] }));
const stoneOptions = (Object.keys(STONE_LABELS) as Array<keyof typeof STONE_LABELS>).map((k) => ({ value: k, label: STONE_LABELS[k] }));
const typeOptions = (Object.keys(JEWELLERY_TYPE_LABELS) as Array<keyof typeof JEWELLERY_TYPE_LABELS>).map((k) => ({ value: k, label: JEWELLERY_TYPE_LABELS[k] }));

function VariantsEditor({ form }: { form: UseFormReturn<Values> }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "variants" });
  const errors = form.formState.errors.variants;
  return (
    <Card title="Metal & stone variants" action={<Button type="button" variant="outline" size="sm" leftIcon={<Plus className="size-4" aria-hidden />} onClick={() => append({ sku_suffix: "", metal_type: "gold", stone_type: "none", purity: "", price_delta: "", stock_quantity: 0, tint_hex: "", is_default: fields.length === 0, is_active: true })}>Add variant</Button>}>
      {fields.length === 0 ? (
        <p className="text-fg-muted text-sm">Only configured variants are offered to customers. Add one per metal/stone combination the shop can actually make.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {fields.map((field, i) => (
            <li key={field.id} className="border-border grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input label="SKU suffix" error={errors?.[i]?.sku_suffix?.message} {...form.register(`variants.${i}.sku_suffix`)} />
              <Select label="Metal" options={metalOptions} {...form.register(`variants.${i}.metal_type`)} />
              <Select label="Stone" options={stoneOptions} {...form.register(`variants.${i}.stone_type`)} />
              <Input label="Purity" placeholder="22K / 18K / 950" {...form.register(`variants.${i}.purity`)} />
              <Input label="Price delta (₹)" inputMode="decimal" error={errors?.[i]?.price_delta?.message} {...form.register(`variants.${i}.price_delta`)} />
              <Input label="Stock" type="number" min={0} error={errors?.[i]?.stock_quantity?.message} {...form.register(`variants.${i}.stock_quantity`, { valueAsNumber: true })} />
              <Input label="Tint (#RRGGBB)" placeholder="#d6a84a" hint="Recolours try-on cut-outs." error={errors?.[i]?.tint_hex?.message} {...form.register(`variants.${i}.tint_hex`)} />
              <div className="flex flex-col justify-end">
                <Checkbox label="Default" {...form.register(`variants.${i}.is_default`)} />
                <Checkbox label="Active" {...form.register(`variants.${i}.is_active`)} />
                <Button type="button" variant="ghost" size="sm" className="text-danger self-start" leftIcon={<Trash2 className="size-4" aria-hidden />} onClick={() => remove(i)}>Remove</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SizesEditor({ form }: { form: UseFormReturn<Values> }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "sizes" });
  const errors = form.formState.errors.sizes;
  return (
    <Card title="Sizes" action={<Button type="button" variant="outline" size="sm" leftIcon={<Plus className="size-4" aria-hidden />} onClick={() => append({ label: "", measurement_mm: "", price_delta: "", stock_quantity: 0, is_default: fields.length === 0 })}>Add size</Button>}>
      {fields.length === 0 ? (
        <p className="text-fg-muted text-sm">Optional. Necklace lengths (16&quot;, 18&quot;), bangle sizes (2.4, 2.6), ring sizes (10–20) or S/M/L for bracelets.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {fields.map((field, i) => (
            <li key={field.id} className="border-border grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input label="Label" error={errors?.[i]?.label?.message} {...form.register(`sizes.${i}.label`)} />
              <Input label="Measurement (mm)" inputMode="decimal" hint="Length, diameter or circumference." error={errors?.[i]?.measurement_mm?.message} {...form.register(`sizes.${i}.measurement_mm`)} />
              <Input label="Price delta (₹)" inputMode="decimal" error={errors?.[i]?.price_delta?.message} {...form.register(`sizes.${i}.price_delta`)} />
              <Input label="Stock" type="number" min={0} {...form.register(`sizes.${i}.stock_quantity`, { valueAsNumber: true })} />
              <div className="flex flex-col justify-end">
                <Checkbox label="Default" {...form.register(`sizes.${i}.is_default`)} />
                <Button type="button" variant="ghost" size="sm" className="text-danger self-start" leftIcon={<Trash2 className="size-4" aria-hidden />} onClick={() => remove(i)}>Remove</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SetComponentsPicker({ form, currentId }: { form: UseFormReturn<Values>; currentId?: string }) {
  const [q, setQ] = useState("");
  const results = useAdminProducts({ q: q || undefined, page_size: 8 });
  const chosen = useWatch({ control: form.control, name: "set_item_ids" });
  const chosenProducts = useAdminProducts({ page_size: 96 });
  const byId = useMemo(() => new Map((chosenProducts.data?.items ?? []).map((p) => [p.id, p])), [chosenProducts.data]);
  const toggle = (p: ProductSummary) => {
    const next = chosen.includes(p.id) ? chosen.filter((id) => id !== p.id) : [...chosen, p.id];
    form.setValue("set_item_ids", next, { shouldDirty: true });
  };
  return (
    <Card title="Set components">
      <p className="text-fg-muted mb-3 text-sm">Pieces that make up this set; they must exist as their own products.</p>
      {chosen.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {chosen.map((id) => (
            <li key={id}>
              <button type="button" onClick={() => { const p = byId.get(id); if (p) toggle(p); else form.setValue("set_item_ids", chosen.filter((x) => x !== id)); }} className="bg-gold/15 inline-flex min-h-9 items-center gap-1 rounded-sm px-2 text-xs" aria-label={`Remove ${byId.get(id)?.name ?? "component"}`}>
                {byId.get(id)?.name ?? id.slice(0, 8)} <Trash2 className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input label="Find a product" placeholder="Search by name or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="mt-2 flex flex-col gap-1">
        {(results.data?.items ?? []).filter((p) => p.id !== currentId && !chosen.includes(p.id)).map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => toggle(p)} className="hover:bg-bg-muted flex min-h-10 w-full items-center justify-between rounded-sm px-2 text-left text-sm">
              <span>{p.name} <span className="text-fg-muted text-xs">{p.sku}</span></span>
              <Plus className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ProductForm({ product }: { product?: ProductDetail }) {
  const router = useRouter();
  const { toast } = useToast();
  const categories = useAdminCategories();
  const collections = useAdminCollections();
  const create = useCreateProduct();
  const update = useUpdateProduct(product?.id ?? "");
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: fromProduct(product) });
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = form;
  const jewelleryType = useWatch({ control: form.control, name: "jewellery_type" });
  const mutation = product ? update : create;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = product ? await update.mutateAsync(toInput(values)) : await create.mutateAsync(toInput(values));
      toast({ title: product ? "Product saved" : "Product created", description: saved.name, tone: "success" });
      if (!product) router.push(`/admin/products/${saved.id}?tab=assets` as never);
    } catch (error) {
      if (!applyApiFieldErrors(error, setError, ["sku", "name", "slug", "category_id", "base_price", "discount_percent", "stock_quantity"])) {
        toast({ title: "Couldn't save the product", description: error instanceof Error ? error.message : undefined, tone: "error" });
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" data-testid="product-form">
      <Card title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" required error={errors.name?.message} {...register("name")} />
          <Input label="SKU" required error={errors.sku?.message} {...register("sku")} />
          <Input label="URL slug" hint="Leave blank to generate from the name." error={errors.slug?.message} {...register("slug")} />
          <Select label="Category" required error={errors.category_id?.message} placeholder="Choose a category" options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))} {...register("category_id")} />
          <Select label="Jewellery type" hint="Decides how it is fitted in try-on." options={typeOptions} {...register("jewellery_type")} />
          <Select label="Gender" options={[{ value: "women", label: "Women" }, { value: "men", label: "Men" }, { value: "unisex", label: "Unisex" }, { value: "kids", label: "Kids" }]} {...register("gender")} />
          <Input label="Short description" wrapperClassName="sm:col-span-2" error={errors.short_description?.message} {...register("short_description")} />
          <Textarea label="Description" wrapperClassName="sm:col-span-2" rows={5} error={errors.description?.message} {...register("description")} />
        </div>
      </Card>
      <Card title="Materials & pricing">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Primary metal" options={metalOptions} {...register("metal_type")} />
          <Input label="Purity" placeholder="22K" {...register("purity")} />
          <Select label="Primary stone" options={stoneOptions} {...register("stone_type")} />
          <Input label="Style" placeholder="traditional / contemporary / minimal" {...register("style")} />
          <Input label="Gross weight (g)" inputMode="decimal" error={errors.gross_weight_g?.message} {...register("gross_weight_g")} />
          <Input label="Net weight (g)" inputMode="decimal" error={errors.net_weight_g?.message} {...register("net_weight_g")} />
          <Input label="Stone weight (ct)" inputMode="decimal" error={errors.stone_weight_ct?.message} {...register("stone_weight_ct")} />
          <Input label="Making charges (₹)" inputMode="decimal" error={errors.making_charges?.message} {...register("making_charges")} />
          <Input label="Base price (₹)" required inputMode="decimal" error={errors.base_price?.message} {...register("base_price")} />
          <Input label="Discount (%)" inputMode="decimal" error={errors.discount_percent?.message} {...register("discount_percent")} />
          <Input label="Stock" type="number" min={0} error={errors.stock_quantity?.message} {...register("stock_quantity", { valueAsNumber: true })} />
          <div className="flex flex-col justify-end"><Checkbox label="Made to order" {...register("is_made_to_order")} /></div>
        </div>
      </Card>
      <Card title="Merchandising">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Occasions" hint="Comma separated: wedding, festive, everyday" {...register("occasions")} />
          <Input label="Tags" hint="Comma separated keywords for search and the stylist." {...register("tags")} />
          <fieldset className="sm:col-span-2">
            <legend className="text-fg-soft text-sm font-medium">Collections</legend>
            <div className="mt-1 grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
              {(collections.data ?? []).map((c) => (
                <Checkbox key={c.id} value={c.id} label={c.name} {...register("collection_ids")} />
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-x-4 sm:col-span-2 lg:grid-cols-4">
            <Checkbox label="Featured on the home page" {...register("is_featured")} />
            <Checkbox label="Mark as new" {...register("is_new")} />
            <Checkbox label="Try-on enabled" {...register("tryon_enabled")} />
            <Checkbox label="Active (visible to customers)" {...register("is_active")} />
          </div>
        </div>
      </Card>
      <VariantsEditor form={form} />
      <SizesEditor form={form} />
      {jewelleryType === "set" && <SetComponentsPicker form={form} currentId={product?.id} />}
      <FormError error={mutation.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={isSubmitting || mutation.isPending}>{product ? "Save changes" : "Create product"}</Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/products")}>Cancel</Button>
      </div>
    </form>
  );
}
