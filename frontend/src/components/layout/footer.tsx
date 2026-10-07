import { Mail, MessageCircle, Phone, ShieldCheck, Sparkles, Store } from "lucide-react";
import Link from "next/link";
import { Logo } from "./logo";
import { FOOTER_LINKS, SITE } from "@/lib/site";

const TRUST = [
  { icon: ShieldCheck, label: "BIS hallmarked gold" },
  { icon: Sparkles, label: "Certified diamonds" },
  { icon: Store, label: "Try in store, buy anywhere" },
];

function InstagramIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="border-border bg-bg-muted border-t">
      <div className="container-x py-14 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="text-fg-muted mt-5 max-w-sm text-sm leading-relaxed">
              {SITE.description}
            </p>
            <ul className="mt-6 flex flex-col gap-3 text-sm">
              <li>
                <a
                  href={`tel:${SITE.phone.replace(/\s/g, "")}`}
                  className="text-fg-soft hover:text-fg inline-flex min-h-11 items-center gap-2"
                >
                  <Phone className="text-accent-text size-4" aria-hidden /> {SITE.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SITE.email}`}
                  className="text-fg-soft hover:text-fg inline-flex min-h-11 items-center gap-2"
                >
                  <Mail className="text-accent-text size-4" aria-hidden /> {SITE.email}
                </a>
              </li>
            </ul>
            <div className="mt-4 flex gap-1">
              <a
                href={SITE.whatsapp}
                target="_blank"
                rel="noreferrer"
                aria-label="Chat on WhatsApp"
                className="touch-target text-fg-soft hover:bg-bg-elevated hover:text-fg inline-flex items-center justify-center rounded-sm"
              >
                <MessageCircle className="size-5" aria-hidden />
              </a>
              <a
                href={SITE.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Jewelora on Instagram"
                className="touch-target text-fg-soft hover:bg-bg-elevated hover:text-fg inline-flex items-center justify-center rounded-sm"
              >
                <InstagramIcon />
              </a>
            </div>
          </div>
          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <nav key={group} aria-label={group}>
              <p className="eyebrow mb-4">{group}</p>
              <ul className="flex flex-col">
                {links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="text-fg-soft hover:text-fg inline-flex min-h-10 items-center text-sm"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <ul className="border-border mt-14 grid gap-4 border-t pt-8 sm:grid-cols-3">
          {TRUST.map(({ icon: Icon, label }) => (
            <li key={label} className="text-fg-soft flex items-center gap-3 text-sm">
              <Icon className="text-accent-text size-5" aria-hidden />
              {label}
            </li>
          ))}
        </ul>

        <div className="text-fg-muted mt-10 flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>
          <p>
            Virtual try-on results are a visual guide. Sizes shown are estimates to be confirmed in
            store.
          </p>
        </div>
      </div>
    </footer>
  );
}
