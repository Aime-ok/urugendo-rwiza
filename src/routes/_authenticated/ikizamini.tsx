import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Clock, CheckCircle2, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LogoutButton } from "@/components/LogoutButton";
import { Button } from "@/components/ui/button";
import { startExam, submitExam, getAttemptReview } from "@/lib/exam.functions";

export const Route = createFileRoute("/_authenticated/ikizamini")({
  head: () => ({
    meta: [
      { title: "Gukora Ikizamini — Igira" },
      { name: "description", content: "Kora ikizamini cy'ibibazo 20 gifite igihe; amanota atsinda ni 12/20." },
      { property: "og:title", content: "Gukora Ikizamini — Igira" },
      { property: "og:description", content: "Ibibazo 20, iminota 20, amanota atsinda 12/20." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExamPage,
});

const DURATION = 20 * 60;

type Q = { id: string; question_text: string; options: string[] };
type Result = { correct: number; wrong: number; total: number; percentage: number; passed: boolean };
type ReviewRow = Awaited<ReturnType<typeof getAttemptReview>>[number];

function ExamPage() {
  const start = useServerFn(startExam);
  const submit = useServerFn(submitExam);
  const review = useServerFn(getAttemptReview);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [result, setResult] = useState<Result | null>(null);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!attemptId || result) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [attemptId, result]);

  useEffect(() => {
    if (attemptId && !result && left <= 0) void finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const clock = useMemo(() => {
    const s = Math.max(0, left);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }, [left]);

  async function begin() {
    setBusy(true);
    try {
      const data = await start({});
      setAttemptId(data.attemptId);
      setQuestions(data.questions);
      setAnswers({});
      setIndex(0);
      setLeft(DURATION);
      setResult(null);
      setRows(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ikizamini ntigishoboye gutangira.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!attemptId) return;
    setBusy(true);
    try {
      const payload = questions.map((q) => ({
        questionId: q.id,
        selectedIndex: answers[q.id] ?? -1,
      }));
      const res = await submit({ data: { attemptId, answers: payload } });
      setResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kubika amanota byanze.");
    } finally {
      setBusy(false);
    }
  }

  async function showReview() {
    if (!attemptId) return;
    const data = await review({ data: { attemptId } });
    setRows(data);
  }

  if (result) {
    return (
      <AppShell right={<LogoutButton />}>
        <BackLink />
        <div className="mx-auto max-w-2xl rounded-2xl bg-card p-6 text-card-foreground shadow-xl sm:p-8">
          <h1 className="text-center text-xl font-bold">AMANOTA YAWE: {result.correct}/{result.total}</h1>
          <p
            className={`mt-2 text-center text-3xl font-extrabold ${result.passed ? "text-success" : "text-destructive"}`}
          >
            {result.passed ? "WATSINZE" : "NTABWO WATSINZE"}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <Stat label="Byahuye" value={String(result.correct)} />
            <Stat label="Byibeshye" value={String(result.wrong)} />
            <Stat label="Ijanisha" value={`${result.percentage}%`} />
            <Stat label="Amanota atsinda" value="12/20" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={showReview} className="bg-primary">
              Reba ibisubizo
            </Button>
            <Button variant="outline" onClick={begin} disabled={busy}>
              Ongera ukore ikizamini
            </Button>
            <Button asChild variant="secondary">
              <Link to="/amateka">Amateka y'ibizamini</Link>
            </Button>
          </div>

          {rows && (
            <div className="mt-8 space-y-4">
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
        </div>
      </AppShell>
    );
  }

  if (!attemptId) {
    return (
      <AppShell right={<LogoutButton />}>
        <BackLink />
        <div className="mx-auto max-w-lg rounded-2xl bg-card p-6 text-card-foreground shadow-xl sm:p-8">
          <h1 className="text-center text-2xl font-bold">Gukora Ikizamini</h1>
          <ul className="mt-5 space-y-3 text-sm">
            <li className="flex gap-2">
              <Clock className="size-5 text-primary" /> Ufite iminota 20 yo gusubiza ibibazo 20
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="size-5 text-success" /> Ukeneye ibisubizo 12 nibura kugira ngo utsinde
            </li>
            <li className="flex gap-2">
              <XCircle className="size-5 text-destructive" /> Ikizamini kirifunga aho ugeze igihe nikirangira
            </li>
          </ul>
          <Button
            onClick={begin}
            disabled={busy}
            className="mt-6 w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {busy ? "Tegereza..." : "Tangira Ikizamini"}
          </Button>
        </div>
      </AppShell>
    );
  }

  const q = questions[index]!;
  const selected = answers[q.id];

  return (
    <AppShell right={<LogoutButton />}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold">
            Ikibazo {index + 1} / {questions.length}
          </span>
          <span className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1 text-sm font-bold">
            <Clock className="size-4" /> {clock}
          </span>
        </div>
        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((index + 1) / questions.length) * 100}%` }}
          />
        </div>

        <div className="rounded-2xl bg-card p-6 text-card-foreground shadow-xl">
          <h2 className="text-lg font-bold">{q.question_text}</h2>
          <div className="mt-4 space-y-3">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setAnswers({ ...answers, [q.id]: i })}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                  selected === i ? "border-accent bg-accent/15" : "border-border hover:border-primary"
                }`}
              >
                <span className="font-bold">{"ABCD"[i]}.</span>
                <span className="flex-1">{opt}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex gap-3">
            <Button variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              Ibanza
            </Button>
            {index < questions.length - 1 ? (
              <Button
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => setIndex(index + 1)}
              >
                Komeza
              </Button>
            ) : (
              <Button className="flex-1 bg-primary" disabled={busy} onClick={finish}>
                Soza ikizamini
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/ahabanza" className="mb-6 inline-flex items-center gap-2 text-sm text-foreground/80 hover:underline">
      <ArrowLeft className="size-4" /> Subira Ahabanza
    </Link>
  );
}
