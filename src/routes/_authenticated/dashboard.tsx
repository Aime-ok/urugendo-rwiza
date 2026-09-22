import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, ClipboardList, History, User } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LogoutButton } from "@/components/LogoutButton";
import { Button } from "@/components/ui/button";
import { getMe } from "@/lib/account.functions";
import { getProgress } from "@/lib/learn.functions";
import { getExamHistory } from "@/lib/exam.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Ahabanza — Urugero Rwiza" },
      {
        name: "description",
        content: "Ahabanza h'umunyeshuri: kwiga no gukora ibizamini by'amategeko y'umuhanda.",
      },
      { property: "og:title", content: "Ahabanza — Urugero Rwiza" },
      { property: "og:description", content: "Hitamo kwiga cyangwa gukora ikizamini." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const me = useServerFn(getMe);
  const progress = useServerFn(getProgress);
  const history = useServerFn(getExamHistory);

  const { data } = useQuery({ queryKey: ["me"], queryFn: () => me({}) });
  const { data: stats } = useQuery({ queryKey: ["progress"], queryFn: () => progress({}) });
  const { data: attempts } = useQuery({ queryKey: ["history"], queryFn: () => history({}) });

  const list = attempts ?? [];
  const passed = list.filter((a) => a.passed).length;
  const failed = list.length - passed;
  const average = list.length
    ? Math.round(list.reduce((s, a) => s + Number(a.percentage), 0) / list.length)
    : 0;

  return (
    <AppShell right={<LogoutButton />}>
      <div className="flex flex-col items-center text-center">
        {data?.avatarUrl ? (
          <img
            src={data.avatarUrl}
            alt={data.fullName || "Umwirondoro"}
            className="size-20 rounded-full border-2 border-accent object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-full bg-accent/25">
            <User className="size-10 text-accent-foreground" />
          </div>
        )}
        <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">
          Murakaza neza{data?.fullName ? `, ${data.fullName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-foreground/70">Wige amategeko y'umuhanda, witegure neza.</p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Ibizamini wakoze" value={String(list.length)} />
        <Stat label="Amanota menshi" value={`${stats?.bestScore ?? 0}/20`} />
        <Stat label="Impuzandengo" value={`${average}%`} />
        <Stat label="Watsinze" value={String(passed)} />
        <Stat label="Ntabwo watsinze" value={String(failed)} />
        <Stat label="Ibibazo wize" value={String(stats?.questionsSeen ?? 0)} />
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <article className="flex flex-col items-center rounded-2xl bg-card p-6 text-card-foreground shadow-xl">
          <div className="flex size-24 items-center justify-center rounded-xl bg-accent/25">
            <BookOpen className="size-11 text-accent-foreground" />
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
          <div className="flex size-24 items-center justify-center rounded-xl bg-primary/15">
            <ClipboardList className="size-11 text-primary" />
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
            <History className="size-4" /> Amateka y'Amanota
          </Link>
        </Button>
        <Button asChild variant="secondary" className="gap-2">
          <Link to="/umwirondoro">
            <User className="size-4" /> Umwirondoro
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-4 text-center text-card-foreground shadow">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
