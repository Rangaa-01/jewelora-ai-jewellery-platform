"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/lib/stores/ui-store";
import { JEWELLERY_TYPE_LABELS } from "@/lib/labels";

const QUICK: Array<keyof typeof JEWELLERY_TYPE_LABELS> = [
  "necklace",
  "earrings",
  "ring",
  "bangle",
  "bracelet",
  "pendant",
];

export function SearchDialog() {
  const open = useUiStore((s) => s.searchOpen);
  const setOpen = useUiStore((s) => s.setSearchOpen);
  const [q, setQ] = useState("");
  const router = useRouter();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const term = q.trim();
    setOpen(false);
    router.push(term ? `/products?q=${encodeURIComponent(term)}` : "/products");
  };

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Search jewellery" size="md">
      <form onSubmit={submit} role="search" className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="text-fg-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
            aria-hidden
          />
          <input
            data-autofocus
            type="search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Temple necklace, diamond studs, 22K bangles…"
            aria-label="Search jewellery"
            className="border-border-strong bg-bg-elevated focus-visible:border-fg focus-visible:outline-ring h-12 w-full rounded-sm border pr-3 pl-10 text-base focus-visible:outline-2 focus-visible:outline-offset-0"
          />
        </div>
        <Button type="submit" size="md">
          Search
        </Button>
      </form>
      <p className="eyebrow mt-6 mb-3">Browse by type</p>
      <ul className="flex flex-wrap gap-2">
        {QUICK.map((type) => (
          <li key={type}>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/products?jewellery_type=${type}`);
              }}
              className="border-border text-fg-soft hover:border-gold hover:text-fg inline-flex min-h-11 items-center rounded-full border px-4 text-sm"
            >
              {JEWELLERY_TYPE_LABELS[type]}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
