import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LogoutButton } from "@/components/LogoutButton";
import { Button } from "@/components/ui/button";
import { getExamHistory, getAttemptReview } from "@/lib/exam.functions";
import { getProgress } from "@/lib/learn.functions";

export const Route = createFileRoute("/_authenticated/amateka")({
  head: () => ({
    meta: [
      { title: "Amateka y'ibizamini — Igira" },
      { name: "description", content: "Reba amanota yawe yashize n'aho ugeze mu kwiga amategeko y'umuhanda." },
      { property: "og:title", content: "Amateka y'ibizamini — Igira" },
      { property: "og:description", content: "Amanota, ijanisha, n'aho ugeze mu masomo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

type ReviewRow = Awaited<ReturnType<typeof getAttemptReview>>[number];

function HistoryPage() {
  const history = useServerFn(getExamHistory);
  const progress = useServerFn(getProgress);
  const review = useServerFn(getAttemptReview);

  const { data: attempts } = useQuery({ queryKey: ["history"], queryFn: () => history({}) });
  const { data: stats } = useQuery({ queryKey: ["progress"], queryFn: () => progress({}) });
  const [rows, setRows] = useState<ReviewRow[] | null>(null);

  return (
    <AppShell right={<LogoutButton />}>
      <Link to="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-foreground/80 hover:underline">
        <ArrowLeft className="size-4" /> Subira Ahabanza
      </Link>

      <section id="aho-ugeze" className="rounded-2xl bg-card p-6 text-card-foreground shadow-xl">
        <h2 className="text-xl font-bold">Aho ugeze</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Ibibazo amaze gukora" value={String(stats?.answered ?? 0)} />
          <Stat label="Yasubije neza" value={String(stats?.correct ?? 0)} />
          <Stat label="Yasubije nabi" value={String(stats?.wrong ?? 0)} />
          <Stat label="Ibizamini yakoze" value={String(stats?.exams ?? 0)} />
          <Stat label="Amanota meza" value={`${stats?.bestScore ?? 0}/20`} />
          <Stat label="Igitabo amazemo" value={`${stats?.coverage ?? 0}%`} />
        </div>
      </section>

      <section className="mt-8 rounded-2xl bg-card p-6 text-card-foreground shadow-xl">
        <h2 className="text-xl font-bold">Amateka y'ibizamini</h2>
        {!attempts?.length && <p className="mt-3 text-sm text-muted-foreground">Nta kizamini urakora.</p>}
        <div className="mt-4 space-y-3">
          {(attempts ?? []).map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
              <div>
                <p className="font-semibold">
                  {a.correct_count}/{a.total} — {a.percentage}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.started_at).toLocaleString("fr-RW")} · Neza {a.correct_count} · Nabi {a.wrong_count}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-bold ${a.passed ? "text-success" : "text-destructive"}`}>
                  {a.passed ? "Watsinze" : "Ntabwo watsinze"}
                </span>
                <Button size="sm" variant="outline" onClick={async () => setRows(await review({ data: { attemptId: a.id } }))}>
                  Reba ibisubizo
                </Button>
              </div>
            </div>
          ))}
        </div>

        {rows && (
          <div className="mt-6 space-y-4">
            {rows.map((r, i) => (
              <div key={r.questionId} className="rounded-xl border p-4">
                <p className="flex items-start gap-2 font-semibold">
                  {r.isCorrect ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                  )}
                  {i + 1}. {r.questionText}
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-semibold">Igisubizo watanze: </span>
                  {r.selectedIndex === null ? "Nta gisubizo" : `${"ABCD"[r.selectedIndex]}. ${r.options[r.selectedIndex]}`}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Igisubizo nyacyo: </span>
                  {"ABCD"[r.correctIndex]}. {r.options[r.correctIndex]}
                </p>
                {r.explanation && <p className="mt-1 text-sm text-muted-foreground">{r.explanation}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
