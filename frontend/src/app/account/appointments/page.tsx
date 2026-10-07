"use client";

import { Calendar } from "lucide-react";
import { AccountListPage } from "@/components/account/account-list-page";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

interface Appointment {
  id: string;
  reference: string;
  starts_at: string;
  status: string;
  store: { name: string };
  party_size: number;
}

export default function AppointmentsPage() {
  return (
    <AccountListPage<Appointment>
      title="Appointments"
      description="Showroom visits you've requested."
      endpoint="/appointments"
      queryKey="appointments"
      icon={Calendar}
      emptyTitle="No appointments yet"
      emptyDescription="Book a private showroom visit and we'll have your saved pieces ready."
      emptyAction={<ButtonLink href="/appointments/new">Book a Visit</ButtonLink>}
      getKey={(a) => a.id}
      renderItem={(a) => (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">
              {formatDate(a.starts_at, { dateStyle: "full", timeStyle: "short" })}
            </p>
            <p className="text-fg-muted text-sm">
              {a.store.name} · {a.party_size} {a.party_size === 1 ? "guest" : "guests"} · Ref{" "}
              {a.reference}
            </p>
          </div>
          <Badge
            tone={
              a.status === "confirmed" ? "emerald" : a.status === "cancelled" ? "danger" : "gold"
            }
          >
            {a.status.replace(/_/g, " ")}
          </Badge>
        </div>
      )}
    />
  );
}
