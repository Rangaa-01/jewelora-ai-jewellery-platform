"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** False during SSR and the first client render, true afterwards. Use to gate persisted client state. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
