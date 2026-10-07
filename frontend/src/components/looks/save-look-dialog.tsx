"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Input, Textarea } from "@/components/ui/field";
import type { SavedLook, SavedLookItemPayload } from "@/lib/api/types";
import { useSaveLook } from "@/lib/looks/use-save-look";

export interface SaveLookDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (look: SavedLook) => void;
  tryonResultId?: string | null;
  items: SavedLookItemPayload[];
  kind?: "look" | "bridal";
  defaultTitle?: string;
}

/** Names and saves a look (optionally attached to a try-on result). */
export function SaveLookDialog({
  open,
  onClose,
  onSaved,
  tryonResultId,
  items,
  kind = "look",
  defaultTitle,
}: SaveLookDialogProps) {
  const { save, pending } = useSaveLook();
  const [title, setTitle] = useState(
    defaultTitle ?? (kind === "bridal" ? "My bridal look" : "My look"),
  );
  const [notes, setNotes] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Save this look"
      description={`${items.length} ${items.length === 1 ? "piece" : "pieces"} will be saved to your account.`}
      size="sm"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) {
            setError("Give your look a name");
            return;
          }
          setError(null);
          const look = await save({ title, kind, tryonResultId, items, notes, isPublic });
          if (look) {
            onSaved?.(look);
            onClose();
          }
        }}
      >
        <Input
          label="Name"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={error ?? undefined}
          maxLength={120}
          data-autofocus
        />
        <Textarea
          label="Notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          hint="Occasion, outfit or anything to remember."
        />
        <Checkbox
          label="Share publicly on the Customer Looks gallery (you can change this later)"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        <Button type="submit" size="lg" loading={pending} disabled={items.length === 0}>
          Save look
        </Button>
      </form>
    </Dialog>
  );
}
