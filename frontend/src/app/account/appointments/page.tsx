"use client";

import { Calendar } from "lucide-react";
import { AccountListPage } from "@/components/account/account-list-page";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { useCancelAppointment } from "@/lib/api/hooks";
import type { Appointment } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

function CancelButton({ appointment }: { appointment: Appointment }) {
  const cancel = useCancelAppointment();
  const { toast } = useToast();
  if (appointment.status !== "requested" && appointment.status !== "confirmed") return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={cancel.isPending}
      onClick={() =>
        cancel.mutate(appointment.id, {
          onError: (e) =>
            toast({ title: "Couldn't cancel", description: errorMessage(e), tone: "error" }),
        })
      }
    >
      Cancel
    </Button>
  );
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
            {a.products.length > 0 && (
              <p className="text-fg-muted mt-1 text-xs">
                Pieces: {a.products.map((p) => p.name).join(", ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              tone={
                a.status === "confirmed" ? "emerald" : a.status === "cancelled" ? "danger" : "gold"
              }
            >
              {a.status.replace(/_/g, " ")}
            </Badge>
            <CancelButton appointment={a} />
          </div>
        </div>
      )}
    />
  );
}
