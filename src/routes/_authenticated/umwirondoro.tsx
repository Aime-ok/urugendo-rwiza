import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, User } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LogoutButton } from "@/components/LogoutButton";
import { getMe } from "@/lib/account.functions";
import { getProgress } from "@/lib/learn.functions";

export const Route = createFileRoute("/_authenticated/umwirondoro")({
  head: () => ({
    meta: [
      { title: "Umwirondoro — Urugero Rwiza" },
      { name: "description", content: "Reba umwirondoro wawe n'aho ugeze mu kwiga." },
      { property: "og:title", content: "Umwirondoro — Urugero Rwiza" },
      { property: "og:description", content: "Amakuru ya konti yawe n'aho ugeze." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const me = useServerFn(getMe);
  const progress = useServerFn(getProgress);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => me({}) });
  const { data: stats } = useQuery({ queryKey: ["progress"], queryFn: () => progress({}) });

  return (
    <AppShell right={<LogoutButton />}>
      <Link to="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-foreground/80 hover:underline">
        <ArrowLeft className="size-4" /> Subira Ahabanza
      </Link>

      <div className="mx-auto max-w-lg rounded-2xl bg-card p-6 text-card-foreground shadow-xl">
        <div className="flex items-center gap-4">
          {data?.avatarUrl ? (
            <img
              src={data.avatarUrl}
              alt={data.fullName || "Umwirondoro"}
              className="size-16 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-accent/25">
              <User className="size-8 text-accent-foreground" />
            </div>
          )}
          <div>
            <p className="text-lg font-bold">{data?.fullName || "Umunyeshuri"}</p>
            <p className="text-sm text-muted-foreground">{data?.email}</p>
            <p className="text-xs text-muted-foreground">Uruhare: {data?.role === "admin" ? "Admin" : "Umunyeshuri"}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-center">
          <Box label="Ibibazo wize" value={String(stats?.questionsSeen ?? 0)} />
          <Box label="Yasubije neza" value={String(stats?.correct ?? 0)} />
          <Box label="Yasubije nabi" value={String(stats?.wrong ?? 0)} />
          <Box label="Aho ugeze" value={`${stats?.coverage ?? 0}%`} />
        </div>
      </div>
    </AppShell>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
