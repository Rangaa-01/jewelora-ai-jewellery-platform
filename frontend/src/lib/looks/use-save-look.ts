"use client";

import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { useCreateLook, useOwnerKey } from "@/lib/api/hooks";
import type { SavedLook, SavedLookItemPayload } from "@/lib/api/types";
import { useUiStore } from "@/lib/stores/ui-store";

export interface SaveLookInput {
  title: string;
  kind?: "look" | "bridal";
  tryonResultId?: string | null;
  items: SavedLookItemPayload[];
  notes?: string;
  isPublic?: boolean;
}

/**
 * Saves a look to the customer's account. Guests are prompted to sign in first and the
 * save runs automatically afterwards. Resolves with the saved look or null if cancelled.
 */
export function useSaveLook() {
  const { signedIn } = useOwnerKey();
  const create = useCreateLook();
  const requestSignIn = useUiStore((s) => s.requestSignIn);
  const { toast } = useToast();

  const persist = async (input: SaveLookInput): Promise<SavedLook | null> => {
    try {
      const look = await create.mutateAsync({
        title: input.title.trim() || "My look",
        kind: input.kind ?? "look",
        tryon_result_id: input.tryonResultId ?? null,
        items: input.items,
        notes: input.notes?.trim() || null,
        is_public: input.isPublic ?? false,
      });
      toast({ title: "Look saved", description: look.title, tone: "success", durationMs: 3000 });
      return look;
    } catch (error) {
      toast({ title: "Couldn't save this look", description: errorMessage(error), tone: "error" });
      return null;
    }
  };

  const save = (input: SaveLookInput): Promise<SavedLook | null> => {
    if (signedIn) return persist(input);
    return new Promise((resolve) => {
      requestSignIn({
        message: "Sign in to keep this look in your account and share it.",
        onSuccess: () => void persist(input).then(resolve),
      });
      // If the dialog is dismissed without signing in, nothing is saved.
      const unsubscribe = useUiStore.subscribe((state, prev) => {
        if (prev.authPrompt && !state.authPrompt) {
          unsubscribe();
          if (!useUiStore.getState().authPrompt) resolve(null);
        }
      });
    });
  };

  return { save, pending: create.isPending, signedIn };
}
