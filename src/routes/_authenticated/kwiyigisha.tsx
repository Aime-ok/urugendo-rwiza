import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LogoutButton } from "@/components/LogoutButton";
import { Button } from "@/components/ui/button";
import { getStudyQuestions, recordStudyAnswer, type StudyQuestion } from "@/lib/learn.functions";

export const Route = createFileRoute("/_authenticated/kwiyigisha")({
  head: () => ({
    meta: [
      { title: "Kwiyigisha — Igira" },
      { name: "description", content: "Wige ku buryo bwawe: ibibazo n'ibisubizo ako kanya, hamwe n'ubusobanuro." },
      { property: "og:title", content: "Kwiyigisha — Igira" },
      { property: "og:description", content: "Ibibazo bishya, gusubiramo, no gukomeza kwiga." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudyPage,
});

type Mode = "new" | "review" | "continue";

function StudyPage() {
  const fetchQuestions = useServerFn(getStudyQuestions);
  const record = useServerFn(recordStudyAnswer);

  const [questions, setQuestions] = useState<StudyQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function start(mode: Mode) {
    setLoading(true);
    try {
      const data = await fetchQuestions({ data: { mode } });
      if (!data.length) {
        toast.error("Nta bibazo birahari muri iki cyiciro.");
        return;
      }
      setQuestions(data);
      setIndex(0);
      setSelected(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Habaye ikibazo.");
    } finally {
      setLoading(false);
    }
  }

  async function choose(i: number) {
    if (selected !== null || !questions) return;
    setSelected(i);
    const q = questions[index]!;
    try {
      await record({ data: { questionId: q.id, correct: i === q.correct_index } });
    } catch {
      /* progress saving is best effort */
    }
  }

  if (!questions) {
    return (
      <AppShell right={<LogoutButton />}>
        <BackLink />
        <div className="mx-auto max-w-lg rounded-2xl bg-card p-6 text-card-foreground shadow-xl sm:p-8">
          <h1 className="text-center text-2xl font-bold">Kwiyigisha</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">Hitamo uburyo ushaka kwigamo</p>
          <div className="mt-6 space-y-3">
            <Button
              disabled={loading}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => start("new")}
            >
              Ibibazo bishya
            </Button>
            <Button disabled={loading} className="w-full bg-primary" onClick={() => start("continue")}>
              Komeza kwiga
            </Button>
            <Button disabled={loading} variant="outline" className="w-full" onClick={() => start("review")}>
              Subiramo ibibazo nigeze gukora
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const q = questions[index]!;
  const isLast = index === questions.length - 1;

  return (
    <AppShell right={<LogoutButton />}>
      <BackLink />
      <div className="mx-auto max-w-2xl">
        <div className="mb-3 flex items-center justify-between text-sm font-semibold">
          <span>
            Ikibazo {index + 1} muri {questions.length}
          </span>
          <span className="rounded-md bg-secondary px-2 py-1 text-xs uppercase">{q.difficulty}</span>
        </div>
        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${((index + 1) / questions.length) * 100}%` }}
          />
        </div>

        <div className="rounded-2xl bg-card p-6 text-card-foreground shadow-xl">
          <h2 className="text-lg font-bold">{q.question_text}</h2>
          <div className="mt-4 space-y-3">
            {q.options.map((opt, i) => {
              const isCorrect = i === q.correct_index;
              const chosen = selected === i;
              const state =
                selected === null
                  ? "border-border hover:border-primary"
                  : isCorrect
                    ? "border-success bg-success/10"
                    : chosen
                      ? "border-destructive bg-destructive/10"
                      : "border-border opacity-70";
              return (
                <button
                  key={i}
                  onClick={() => choose(i)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${state}`}
                >
                  <span className="font-bold">{"ABCD"[i]}.</span>
                  <span className="flex-1">{opt}</span>
                  {selected !== null && isCorrect && <CheckCircle2 className="size-5 text-success" />}
                  {selected !== null && chosen && !isCorrect && <XCircle className="size-5 text-destructive" />}
                </button>
              );
            })}
          </div>

          {selected !== null && (
            <div className="mt-5 rounded-xl bg-muted p-4">
              <p className="font-semibold">
                {selected === q.correct_index ? "Waribashije!" : "Ntabwo ari cyo."}
              </p>
              <p className="mt-1 text-sm">
                <span className="font-semibold">Igisubizo nyacyo: </span>
                {"ABCD"[q.correct_index]}. {q.options[q.correct_index]}
              </p>
              {q.explanation && <p className="mt-2 text-sm text-muted-foreground">{q.explanation}</p>}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <Button
              variant="outline"
              disabled={index === 0}
              onClick={() => {
                setIndex(index - 1);
                setSelected(null);
              }}
            >
              Subira inyuma
            </Button>
            <Button
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={selected === null}
              onClick={() => {
                if (isLast) {
                  setQuestions(null);
                  toast.success("Warangije iri somo. Komeza kwiga!");
                } else {
                  setIndex(index + 1);
                  setSelected(null);
                }
              }}
            >
              {isLast ? "Soza" : "Komeza"}
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function BackLink() {
  return (
    <Link to="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-foreground/80 hover:underline">
      <ArrowLeft className="size-4" /> Subira Ahabanza
    </Link>
  );
}
