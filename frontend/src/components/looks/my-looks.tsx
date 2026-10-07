"use client";

import {
  Calendar,
  Camera,
  Copy,
  Download,
  Globe,
  Images,
  Lock,
  MessageCircle,
  Share2,
  Trash,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useLookActions } from "./look-actions";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { useDeleteLook, useLooks, useOwnerKey, useUpdateLook } from "@/lib/api/hooks";
import type { SavedLook } from "@/lib/api/types";
import { formatDate, formatPrice } from "@/lib/format";
import { useUiStore } from "@/lib/stores/ui-store";

function LookCard({ look }: { look: SavedLook }) {
  const actions = useLookActions();
  const update = useUpdateLook();
  const remove = useDeleteLook();
  const { toast } = useToast();
  const slugs = look.items.map((i) => i.product.slug).join(",");
  return (
    <li className="border-border bg-bg-elevated grid gap-5 rounded-lg border p-4 sm:grid-cols-[10rem_1fr]">
      <div className="bg-bg-muted relative aspect-[4/5] overflow-hidden rounded-md">
        {look.preview_url ? (
          <Image
            src={look.preview_url}
            alt={look.title}
            fill
            sizes="160px"
            className="object-cover"
          />
        ) : (
          <div className="text-gold/60 flex size-full items-center justify-center">
            <Images className="size-8" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl">{look.title}</h2>
            <p className="text-fg-muted text-sm">
              {look.kind === "bridal" ? "Bridal look" : "Look"} · {formatDate(look.created_at)} ·{" "}
              {formatPrice(look.total_price)}
            </p>
          </div>
          <Badge tone={look.is_public ? "emerald" : "neutral"}>
            {look.is_public ? (
              <>
                <Globe className="size-3" aria-hidden /> Public
              </>
            ) : (
              <>
                <Lock className="size-3" aria-hidden /> Private
              </>
            )}
          </Badge>
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {look.items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/products/${item.product.slug}`}
                className="border-border hover:border-gold inline-flex min-h-8 items-center rounded-full border px-3 text-xs"
              >
                {item.product.name}
              </Link>
            </li>
          ))}
        </ul>
        {look.notes && (
          <p className="text-fg-soft mt-3 text-sm whitespace-pre-line">{look.notes}</p>
        )}
        <div className="mt-auto flex flex-wrap gap-1 pt-4">
          <ButtonLink
            href={`/try-on?products=${slugs}`}
            size="sm"
            leftIcon={<Camera className="size-3.5" aria-hidden />}
          >
            Try again
          </ButtonLink>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Share2 className="size-3.5" aria-hidden />}
            loading={actions.pending}
            onClick={() => void actions.whatsapp(look)}
          >
            WhatsApp
          </Button>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Copy className="size-3.5" aria-hidden />}
            loading={actions.pending}
            onClick={() => void actions.copy(look)}
          >
            Copy link
          </Button>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Download className="size-3.5" aria-hidden />}
            disabled={!look.preview_url}
            onClick={() => void actions.download(look)}
          >
            Download
          </Button>
          <ButtonLink
            href={`/appointments/new?look=${look.share_token ?? ""}&products=${slugs}`}
            size="sm"
            variant="ghost"
            leftIcon={<Calendar className="size-3.5" aria-hidden />}
          >
            Book a visit
          </ButtonLink>
          <ButtonLink
            href={`/enquire?${look.share_token ? `look=${look.share_token}` : `product=${look.items[0]?.product.slug ?? ""}`}`}
            size="sm"
            variant="ghost"
            leftIcon={<MessageCircle className="size-3.5" aria-hidden />}
          >
            Enquire
          </ButtonLink>
          <Button
            size="sm"
            variant="ghost"
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { id: look.id, is_public: !look.is_public },
                {
                  onError: (e) =>
                    toast({
                      title: "Couldn't update",
                      description: errorMessage(e),
                      tone: "error",
                    }),
                },
              )
            }
          >
            {look.is_public ? "Make private" : "Make public"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Delete ${look.title}`}
            leftIcon={<Trash className="size-3.5" aria-hidden />}
            loading={remove.isPending}
            onClick={() => {
              if (window.confirm(`Delete “${look.title}”? This can't be undone.`))
                remove.mutate(look.id, {
                  onError: (e) =>
                    toast({
                      title: "Couldn't delete",
                      description: errorMessage(e),
                      tone: "error",
                    }),
                });
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </li>
  );
}

export function MyLooksView() {
  const { signedIn, pending } = useOwnerKey();
  const looks = useLooks();
  const requestSignIn = useUiStore((s) => s.requestSignIn);
  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container className="max-w-5xl">
        <p className="eyebrow mb-2">Saved looks</p>
        <h1 className="text-4xl md:text-5xl">Your looks</h1>
        <p className="text-fg-muted mt-2">
          Every try-on you chose to keep, including complete bridal looks. Share them, bring them to
          the store, or try them again.
        </p>
        <div className="mt-8">
          {pending || (signedIn && looks.isPending) ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
          ) : !signedIn ? (
            <EmptyState
              icon={Images}
              title="Sign in to see your looks"
              description="Saved looks live in your account so you can share them and find them on any device."
              action={
                <Button
                  onClick={() => requestSignIn({ message: "Sign in to see your saved looks." })}
                >
                  Sign in
                </Button>
              }
            />
          ) : looks.error || !looks.data ? (
            <ErrorState onRetry={() => void looks.refetch()} />
          ) : looks.data.length === 0 ? (
            <EmptyState
              icon={Images}
              title="No saved looks yet"
              description="Create a look in the try-on studio and save it to see it here."
              action={<ButtonLink href="/try-on">Open the try-on studio</ButtonLink>}
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {looks.data.map((look) => (
                <LookCard key={look.id} look={look} />
              ))}
            </ul>
          )}
        </div>
      </Container>
    </Section>
  );
}
