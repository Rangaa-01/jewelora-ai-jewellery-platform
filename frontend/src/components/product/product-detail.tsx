"use client";

import { Calendar, Camera, Heart, MessageCircle, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProductViewerSlot } from "./product-viewer-slot";
import { SizeSelector, VariantSelector, variantLabel } from "./variant-selectors";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { isApiError } from "@/lib/api/client";
import { useProduct, useProducts } from "@/lib/api/hooks";
import type { ProductDetail as ProductDetailType } from "@/lib/api/types";
import { formatWeight } from "@/lib/format";
import { JEWELLERY_TYPE_LABELS, METAL_LABELS, STONE_LABELS } from "@/lib/labels";
import { useShopperStore } from "@/lib/stores/shopper-store";

function Specs({ product }: { product: ProductDetailType }) {
  const rows: Array<[string, string | null]> = [
    ["SKU", product.sku],
    ["Type", JEWELLERY_TYPE_LABELS[product.jewellery_type]],
    ["Metal", `${METAL_LABELS[product.metal_type]}${product.purity ? ` · ${product.purity}` : ""}`],
    ["Stones", product.stone_type === "none" ? "None" : STONE_LABELS[product.stone_type]],
    ["Gross weight", formatWeight(product.gross_weight_g)],
    ["Net weight", formatWeight(product.net_weight_g)],
    ["Stone weight", product.stone_weight_ct ? `${Number(product.stone_weight_ct)} ct` : null],
    [
      "Making charges",
      Number(product.making_charges) > 0
        ? `₹${Number(product.making_charges).toLocaleString("en-IN")}`
        : null,
    ],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-fg-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      {product.diamond_details &&
        Object.entries(product.diamond_details).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-fg-muted capitalize">Diamond {k.replace(/_/g, " ")}</dt>
            <dd>{String(v)}</dd>
          </div>
        ))}
    </dl>
  );
}

export function ProductDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const query = useProduct(slug);
  const product = query.data;
  const { toast } = useToast();
  const addToCart = useShopperStore((s) => s.addToCart);
  const toggleWishlist = useShopperStore((s) => s.toggleWishlist);
  const markViewed = useShopperStore((s) => s.markViewed);
  const wishlisted = useShopperStore((s) =>
    product ? s.wishlist.some((w) => w.productId === product.id) : false,
  );

  const [variantChoice, setVariantChoice] = useState<string | null>(null);
  const [sizeChoice, setSizeChoice] = useState<string | null>(null);
  // Reset user choices when a different product loads (render-phase derived state).
  const [choicesFor, setChoicesFor] = useState<string | null>(null);
  if (product && choicesFor !== product.id) {
    setChoicesFor(product.id);
    setVariantChoice(null);
    setSizeChoice(null);
  }
  const defaultVariantId = product
    ? ((
        product.variants.find((v) => v.is_default && v.is_active) ??
        product.variants.find((v) => v.is_active)
      )?.id ?? null)
    : null;
  const defaultSizeId = product
    ? ((product.sizes.find((s) => s.is_default) ?? product.sizes[0])?.id ?? null)
    : null;
  const variantId = variantChoice ?? defaultVariantId;
  const sizeId = sizeChoice ?? defaultSizeId;
  const setVariantId = setVariantChoice;
  const setSizeId = setSizeChoice;

  useEffect(() => {
    if (product) markViewed(product.slug);
  }, [product, markViewed]);

  const related = useProducts(
    { jewellery_type: product ? [product.jewellery_type] : undefined, page_size: 4 },
    !!product,
  );

  const variant = useMemo(
    () => product?.variants.find((v) => v.id === variantId) ?? null,
    [product, variantId],
  );
  const size = useMemo(
    () => product?.sizes.find((s) => s.id === sizeId) ?? null,
    [product, sizeId],
  );
  const price = useMemo(() => {
    if (!product) return "0";
    const base = variant ? Number(variant.price) : Number(product.price);
    return String(base + (size ? Number(size.price_delta) : 0));
  }, [product, variant, size]);

  if (query.isPending) {
    return (
      <Section padding="sm" aria-busy="true">
        <Container className="grid gap-10 lg:grid-cols-2">
          <Skeleton className="aspect-square rounded-lg" />
          <div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-10 w-3/4" />
            <Skeleton className="mt-4 h-6 w-32" />
            <Skeleton className="mt-8 h-24 w-full" />
            <Skeleton className="mt-6 h-12 w-full" />
          </div>
        </Container>
      </Section>
    );
  }
  if (query.error || !product) {
    const notFound = isApiError(query.error) && query.error.isNotFound;
    return (
      <Section>
        <Container className="max-w-xl">
          <ErrorState
            title={notFound ? "This piece isn’t available" : "We couldn’t load this piece"}
            description={
              notFound
                ? "It may have sold out or been retired from the catalogue. Explore similar jewellery instead."
                : undefined
            }
            onRetry={notFound ? undefined : () => void query.refetch()}
            action={
              <ButtonLink href="/products" variant={notFound ? "primary" : "outline"}>
                Browse jewellery
              </ButtonLink>
            }
          />
        </Container>
      </Section>
    );
  }

  const available = product.in_stock || product.is_made_to_order;
  const tryOnHref =
    `/try-on?product=${product.slug}${variantId ? `&variant=${variantId}` : ""}` as const;

  const onAddToCart = () => {
    addToCart({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price,
      imageUrl: product.primary_image?.url ?? null,
      variantId,
      variantLabel: variant ? variantLabel(variant) : null,
      sizeId,
      sizeLabel: size?.label ?? null,
    });
    toast({
      title: "Added to your bag",
      description: product.name,
      tone: "success",
      action: { label: "View bag", onClick: () => router.push("/cart") },
    });
  };
  const onWishlist = () => {
    const added = toggleWishlist({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      imageUrl: product.primary_image?.url ?? null,
    });
    toast({
      title: added ? "Saved to wishlist" : "Removed from wishlist",
      tone: "success",
      durationMs: 2500,
    });
  };

  return (
    <>
      <Section padding="sm">
        <Container>
          <nav aria-label="Breadcrumb" className="text-fg-muted mb-6 text-sm">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/products" className="hover:text-fg">
                  Jewellery
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href={`/products?category=${product.category.slug}`}
                  className="hover:text-fg"
                >
                  {product.category.name}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-fg">
                {product.name}
              </li>
            </ol>
          </nav>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <ProductViewerSlot product={product} variantId={variantId} />
            <div className="flex flex-col gap-7">
              <div>
                <div className="mb-3 flex flex-wrap gap-2">
                  {product.is_new && <Badge tone="emerald">New</Badge>}
                  {product.tryon_enabled && <Badge tone="gold">Virtual try-on</Badge>}
                  {product.has_3d && <Badge tone="neutral">3D view</Badge>}
                  {!available && <Badge tone="danger">Sold out</Badge>}
                  {product.is_made_to_order && !product.in_stock && (
                    <Badge tone="neutral">Made to order</Badge>
                  )}
                </div>
                <h1 className="text-3xl md:text-5xl">{product.name}</h1>
                {product.short_description && (
                  <p className="text-fg-muted mt-3">{product.short_description}</p>
                )}
                <div className="mt-5">
                  <Price
                    price={price}
                    basePrice={variant ? undefined : product.base_price}
                    discountPercent={variant ? undefined : product.discount_percent}
                    size="lg"
                  />
                  <p className="text-fg-muted mt-1 text-xs">
                    Inclusive of all taxes. Final gold price follows the day’s rate and is confirmed
                    at purchase.
                  </p>
                </div>
              </div>

              <VariantSelector
                variants={product.variants}
                value={variantId}
                onChange={setVariantId}
              />
              <SizeSelector
                sizes={product.sizes}
                value={sizeId}
                onChange={setSizeId}
                kind={product.jewellery_type}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                {product.tryon_enabled ? (
                  <ButtonLink
                    href={tryOnHref}
                    size="lg"
                    leftIcon={<Camera className="size-5" aria-hidden />}
                  >
                    Try It On
                  </ButtonLink>
                ) : (
                  <Button
                    size="lg"
                    variant="outline"
                    disabled
                    title="Try-on assets are not available for this piece yet"
                  >
                    Try-on not available
                  </Button>
                )}
                <Button
                  size="lg"
                  variant={product.tryon_enabled ? "outline" : "primary"}
                  leftIcon={<ShoppingBag className="size-5" aria-hidden />}
                  onClick={onAddToCart}
                  disabled={!available}
                >
                  {available ? "Add to Bag" : "Sold out"}
                </Button>
                <Button
                  size="md"
                  variant="ghost"
                  leftIcon={
                    <Heart
                      className={wishlisted ? "fill-gold text-gold size-5" : "size-5"}
                      aria-hidden
                    />
                  }
                  onClick={onWishlist}
                  aria-pressed={wishlisted}
                >
                  {wishlisted ? "In your wishlist" : "Add to Wishlist"}
                </Button>
                <ButtonLink
                  href={`/appointments/new?product=${product.slug}`}
                  size="md"
                  variant="ghost"
                  leftIcon={<Calendar className="size-5" aria-hidden />}
                >
                  Book Appointment
                </ButtonLink>
              </div>
              <ButtonLink
                href={`/enquire?product=${product.slug}`}
                variant="link"
                leftIcon={<MessageCircle className="size-4" aria-hidden />}
                className="self-start"
              >
                Ask About This Jewellery
              </ButtonLink>

              <Tabs defaultValue="details">
                <TabList label="Product information">
                  <Tab value="details">Details</Tab>
                  <Tab value="description">Description</Tab>
                  {product.set_items.length > 0 && <Tab value="set">In this set</Tab>}
                </TabList>
                <TabPanel value="details">
                  <Specs product={product} />
                </TabPanel>
                <TabPanel value="description">
                  <p className="text-fg-soft text-sm leading-relaxed whitespace-pre-line">
                    {product.description ??
                      "A full description for this piece will be added by the shop."}
                  </p>
                </TabPanel>
                {product.set_items.length > 0 && (
                  <TabPanel value="set">
                    <ul className="flex flex-col gap-2 text-sm">
                      {product.set_items.map((item) => (
                        <li key={item.product.id}>
                          <Link
                            href={`/products/${item.product.slug}`}
                            className="text-accent-text underline-offset-4 hover:underline"
                          >
                            {item.product.name}
                          </Link>
                          {item.quantity > 1 && (
                            <span className="text-fg-muted"> × {item.quantity}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </TabPanel>
                )}
              </Tabs>
            </div>
          </div>
        </Container>
      </Section>
      <Section padding="sm" tone="muted">
        <Container>
          <h2 className="mb-8 text-3xl">You may also like</h2>
          <ProductGrid
            products={related.data?.items.filter((p) => p.id !== product.id).slice(0, 4)}
            loading={related.isPending}
            error={related.error}
            skeletons={4}
            emptyTitle="More pieces are on their way"
            emptyDescription="Explore the full catalogue for similar jewellery."
            emptyAction={
              <ButtonLink href="/products" variant="outline">
                Browse all
              </ButtonLink>
            }
          />
        </Container>
      </Section>
    </>
  );
}
