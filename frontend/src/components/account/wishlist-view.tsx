"use client";

import { Calendar, Camera, Heart, MessageCircle, ShoppingBag, Trash } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ProductImagePlaceholder } from "@/components/catalogue/product-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/lib/api/hooks";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useShopperStore } from "@/lib/stores/shopper-store";

export function WishlistView() {
  const hydrated = useHydrated();
  const items = useShopperStore((s) => s.wishlist);
  const remove = useShopperStore((s) => s.removeFromWishlist);
  const addToCart = useShopperStore((s) => s.addToCart);
  const { data: session } = useSession();
  const { toast } = useToast();

  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Wishlist</p>
            <h1 className="text-4xl md:text-5xl">Saved jewellery</h1>
          </div>
          {hydrated && items.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <ButtonLink
                href={`/try-on?products=${items.map((i) => i.slug).join(",")}`}
                variant="outline"
                leftIcon={<Camera className="size-4" aria-hidden />}
              >
                Try all on
              </ButtonLink>
              <ButtonLink
                href={`/appointments/new?products=${items.map((i) => i.slug).join(",")}`}
                variant="outline"
                leftIcon={<Calendar className="size-4" aria-hidden />}
              >
                Book a visit
              </ButtonLink>
            </div>
          )}
        </div>
        {!session && hydrated && (
          <p className="border-border bg-bg-muted text-fg-soft mt-4 rounded-sm border px-4 py-3 text-sm">
            Your wishlist is saved on this device.{" "}
            <Link
              href="/account/login?next=/wishlist"
              className="text-accent-text underline-offset-4 hover:underline"
            >
              Sign in
            </Link>{" "}
            to keep it across devices and share it.
          </p>
        )}
        <div className="mt-8">
          {!hydrated ? (
            <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Nothing saved yet"
              description="Tap the heart on any piece to keep it here, compare, try on, or send to the store."
              action={<ButtonLink href="/products">Browse jewellery</ButtonLink>}
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {items.map((item) => (
                <li
                  key={item.productId}
                  className="border-border bg-bg-elevated flex gap-4 rounded-lg border p-4"
                >
                  <Link
                    href={`/products/${item.slug}`}
                    className="bg-bg-muted relative size-24 shrink-0 overflow-hidden rounded-md sm:size-28"
                  >
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt=""
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    ) : (
                      <ProductImagePlaceholder />
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={`/products/${item.slug}`}
                      className="hover:text-accent-text font-medium"
                    >
                      {item.name}
                    </Link>
                    <Price price={item.price} size="sm" className="mt-1" />
                    <div className="mt-auto flex flex-wrap gap-1 pt-3">
                      <ButtonLink
                        href={`/try-on?product=${item.slug}`}
                        size="sm"
                        variant="outline"
                        leftIcon={<Camera className="size-3.5" aria-hidden />}
                      >
                        Try on
                      </ButtonLink>
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<ShoppingBag className="size-3.5" aria-hidden />}
                        onClick={() => {
                          addToCart({
                            productId: item.productId,
                            slug: item.slug,
                            name: item.name,
                            price: item.price,
                            imageUrl: item.imageUrl,
                            variantId: null,
                            variantLabel: null,
                            sizeId: null,
                            sizeLabel: null,
                          });
                          toast({ title: "Added to your bag", tone: "success", durationMs: 2500 });
                        }}
                      >
                        Add to bag
                      </Button>
                      <ButtonLink
                        href={`/enquire?product=${item.slug}`}
                        size="sm"
                        variant="ghost"
                        leftIcon={<MessageCircle className="size-3.5" aria-hidden />}
                      >
                        Enquire
                      </ButtonLink>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove ${item.name}`}
                        leftIcon={<Trash className="size-3.5" aria-hidden />}
                        onClick={() => remove(item.productId)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </Section>
  );
}
