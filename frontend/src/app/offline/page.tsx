import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "You're offline", robots: { index: false } };

export default function OfflinePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="max-w-md text-center">
        <p className="eyebrow mb-3">Offline</p>
        <h1 className="font-display text-4xl text-ink">You&apos;re not connected</h1>
        <p className="mt-4 text-ink-muted">
          Browsing, virtual try-on and your bag need a connection. Pages you have already
          visited may still open. Reconnect and try again.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/">Back to home</ButtonLink>
        </div>
      </div>
    </main>
  );
}
