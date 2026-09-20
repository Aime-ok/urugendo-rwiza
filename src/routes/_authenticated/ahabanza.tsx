import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, ClipboardList, History, BarChart3, Shield } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LogoutButton } from "@/components/LogoutButton";
import { Button } from "@/components/ui/button";
import { getMe } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/ahabanza")({
  head: () => ({
    meta: [
      { title: "Ahabanza — Igira" },
      { name: "description", content: "Ahabanza h'umunyeshuri: kwiyigisha no gukora ikizamini cy'amategeko y'umuhanda." },
      { property: "og:title", content: "Ahabanza — Igira" },
      { property: "og:description", content: "Hitamo kwiyigisha cyangwa gukora ikizamini." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const me = useServerFn(getMe);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => me({}) });

  return (
    <AppShell right={<LogoutButton />}>
      <div className="text-center">
        <h1 className="text-4xl font-extrabold sm:text-5xl">Ahabanza</h1>
        <p className="mt-2 text-sm text-foreground/70">
          Murakaza neza{data?.fullName ? `, ${data.fullName}` : ""}!
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <article className="flex flex-col items-center rounded-2xl bg-card p-6 text-card-foreground shadow-xl">
          <div className="flex size-28 items-center justify-center rounded-xl bg-accent/25">
            <BookOpen className="size-12 text-accent-foreground" />
          </div>
          <h2 className="mt-5 text-xl font-bold">Kwiyigisha</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Wige ku buryo bwawe ukoreshe ibibazo n'ibisubizo ako kanya
          </p>
          <Button asChild className="mt-5 w-full bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/kwiyigisha">Tangira Kwiga</Link>
          </Button>
        </article>

        <article className="flex flex-col items-center rounded-2xl bg-card p-6 text-card-foreground shadow-xl">
          <div className="flex size-28 items-center justify-center rounded-xl bg-primary/15">
            <ClipboardList className="size-12 text-primary" />
          </div>
          <h2 className="mt-5 text-xl font-bold">Gukora Ikizamini</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Kora ikizamini gifite igihe kandi ugerageze ubumenyi bwawe
          </p>
          <Button asChild className="mt-5 w-full bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/ikizamini">Tangira Ikizamini</Link>
          </Button>
        </article>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild variant="secondary" className="gap-2">
          <Link to="/amateka">
            <History className="size-4" /> Amateka y'ibizamini
          </Link>
        </Button>
        <Button asChild variant="secondary" className="gap-2">
          <Link to="/amateka" hash="aho-ugeze">
            <BarChart3 className="size-4" /> Aho ugeze
          </Link>
        </Button>
        {data?.isAdmin && (
          <Button asChild variant="secondary" className="gap-2">
            <Link to="/admin">
              <Shield className="size-4" /> Ubuyobozi
            </Link>
          </Button>
        )}
      </div>
    </AppShell>
  );
}
