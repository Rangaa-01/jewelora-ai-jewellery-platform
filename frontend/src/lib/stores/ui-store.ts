"use client";

import { create } from "zustand";

export interface AuthPrompt {
  /** Why we are asking, shown in the dialog. */
  message: string;
  /** Runs once the customer has signed in (or registered). */
  onSuccess?: () => void;
}

interface UiState {
  mobileNavOpen: boolean;
  searchOpen: boolean;
  authPrompt: AuthPrompt | null;
  setMobileNavOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  requestSignIn: (prompt: AuthPrompt) => void;
  closeAuthPrompt: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  mobileNavOpen: false,
  searchOpen: false,
  authPrompt: null,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  requestSignIn: (prompt) => set({ authPrompt: prompt }),
  closeAuthPrompt: () => set({ authPrompt: null }),
}));
