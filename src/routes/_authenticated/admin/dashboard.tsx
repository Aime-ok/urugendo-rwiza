import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Star, Pencil, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LogoutButton } from "@/components/LogoutButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getMe } from "@/lib/account.functions";
import {
  uploadBook,
  listBooks,
  setActiveBook,
  deleteBook,
  listQuestions,
  saveQuestion,
  deleteQuestion,
  adminOverview,
  getBookFileUrl,
} from "@/lib/books.functions";
import { importQuestions, importStats, listReviewQuestions } from "@/lib/import.functions";
import { parseQuestionsFromPdf } from "@/lib/pdf-import";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Ubuyobozi — Urugero Rwiza" },
      { name: "description", content: "Shyiraho igitabo cya PDF, ukore ibibazo, kandi ukurikirane abanyeshuri." },
      { property: "og:title", content: "Ubuyobozi — Urugero Rwiza" },
      { property: "og:description", content: "Gucunga igitabo, ibibazo n'amanota y'abanyeshuri." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

type QuestionRow = Awaited<ReturnType<typeof listQuestions>>[number];

type Draft = {
  id?: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
};

const emptyDraft: Draft = {
  questionText: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: "",
  difficulty: "medium",
};

function AdminPage() {
  const qc = useQueryClient();
  const me = useServerFn(getMe);
  const upload = useServerFn(uploadBook);
  const books = useServerFn(listBooks);
  const activate = useServerFn(setActiveBook);
  const removeBook = useServerFn(deleteBook);
  const runImport = useServerFn(importQuestions);
  const importCounts = useServerFn(importStats);
  const reviewList = useServerFn(listReviewQuestions);
  const bookUrl = useServerFn(getBookFileUrl);
  const questions = useServerFn(listQuestions);
  const save = useServerFn(saveQuestion);
  const removeQuestion = useServerFn(deleteQuestion);
  const overview = useServerFn(adminOverview);

  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: () => me({}) });
  const isAdmin = profile?.isAdmin === true;

  const { data: bookList } = useQuery({ queryKey: ["books"], queryFn: () => books({}), enabled: isAdmin });
  const { data: questionList } = useQuery({
    queryKey: ["questions"],
    queryFn: () => questions({}),
    enabled: isAdmin,
  });
  const { data: stats } = useQuery({ queryKey: ["overview"], queryFn: () => overview({}), enabled: isAdmin });
  const { data: imported } = useQuery({
    queryKey: ["import-stats"],
    queryFn: () => importCounts({}),
    enabled: isAdmin,
  });
  const { data: review } = useQuery({
    queryKey: ["review-questions"],
    queryFn: () => reviewList({}),
    enabled: isAdmin,
  });

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const activeBook = (bookList ?? []).find((b) => b.is_active);

  async function handleUpload() {
    if (!file || !title.trim()) {
      toast.error("Andika izina ry'igitabo kandi uhitemo dosiye ya PDF.");
      return;
    }
    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Gusoma dosiye byanze."));
        reader.readAsDataURL(file);
      });

      const buffer = new Uint8Array(await file.arrayBuffer());
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(buffer);
      const { text } = await extractText(pdf, { mergePages: true });
      const content = String(text).trim();
      if (content.length < 200) {
        throw new Error("Iyi PDF nta nyandiko isomeka irimo (ishobora kuba ari amafoto).");
      }

      const res = await upload({ data: { title: title.trim(), fileBase64: base64, content } });
      toast.success(`Igitabo cyabitswe (inyuguti ${res.characters}).`);
      setTitle("");
      setFile(null);
      await qc.invalidateQueries({ queryKey: ["books"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kohereza byanze.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate(bookId: string) {
    setBusy(true);
    try {
      const res = await generate({ data: { bookId, count: 20 } });
      toast.success(`Ibibazo ${res.created} byakozwe.`);
      await qc.invalidateQueries({ queryKey: ["questions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gukora ibibazo byanze.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell right={<LogoutButton admin />}>
      <Back />
      <h1 className="mb-6 text-3xl font-extrabold">Ubuyobozi</h1>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Abanyeshuri" value={String(stats?.learners ?? 0)} />
        <Stat label="Ibibazo" value={String(stats?.questions ?? 0)} />
        <Stat label="Ibizamini byakozwe" value={String(stats?.exams ?? 0)} />
        <Stat label="Batsinze" value={`${stats?.passRate ?? 0}%`} />
      </div>

      <section className="mt-8 rounded-2xl bg-card p-6 text-card-foreground shadow-xl">
        <h2 className="text-xl font-bold">Igitabo (PDF)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Igitabo gikora: {activeBook ? activeBook.title : "nta na kimwe"}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Izina ry'igitabo</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdf">Dosiye ya PDF</Label>
            <Input
              id="pdf"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <Button className="mt-4 bg-primary" disabled={busy} onClick={handleUpload}>
          {busy ? "Tegereza..." : "Ohereza igitabo"}
        </Button>

        <div className="mt-6 space-y-3">
          {(bookList ?? []).map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
              <div>
                <p className="font-semibold">
                  {b.title} {b.is_active && <span className="text-xs text-success">(gikora)</span>}
                </p>
                <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString("fr-RW")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={busy}
                  onClick={() => handleGenerate(b.id)}
                >
                  Kora ibibazo
                </Button>
                {!b.is_active && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await activate({ data: { bookId: b.id } });
                      await qc.invalidateQueries({ queryKey: ["books"] });
                    }}
                  >
                    <Star className="size-4" /> Gishyire imbere
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    await removeBook({ data: { bookId: b.id } });
                    await qc.invalidateQueries();
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl bg-card p-6 text-card-foreground shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Ibibazo ({questionList?.length ?? 0})</h2>
          <Button size="sm" className="bg-primary" onClick={() => setDraft({ ...emptyDraft })}>
            <Plus className="size-4" /> Ongeraho ikibazo
          </Button>
        </div>

        {draft && (
          <div className="mt-4 space-y-3 rounded-xl border p-4">
            <div className="space-y-2">
              <Label>Ikibazo</Label>
              <Textarea
                value={draft.questionText}
                onChange={(e) => setDraft({ ...draft, questionText: e.target.value })}
              />
            </div>
            {draft.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={draft.correctIndex === i}
                  onChange={() => setDraft({ ...draft, correctIndex: i })}
                />
                <span className="w-5 font-bold">{"ABCD"[i]}</span>
                <Input
                  value={o}
                  onChange={(e) => {
                    const options = [...draft.options];
                    options[i] = e.target.value;
                    setDraft({ ...draft, options });
                  }}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label>Ubusobanuro</Label>
              <Textarea
                value={draft.explanation}
                onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="bg-primary"
                onClick={async () => {
                  try {
                    await save({
                      data: {
                        id: draft.id,
                        questionText: draft.questionText,
                        options: draft.options,
                        correctIndex: draft.correctIndex,
                        explanation: draft.explanation,
                        difficulty: draft.difficulty,
                        bookId: activeBook?.id ?? null,
                      },
                    });
                    setDraft(null);
                    await qc.invalidateQueries({ queryKey: ["questions"] });
                    toast.success("Byabitswe.");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Kubika byanze.");
                  }
                }}
              >
                Bika
              </Button>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Hagarika
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {(questionList ?? []).map((q: QuestionRow) => {
            const options = (q.options as unknown as string[]) ?? [];
            return (
              <div key={q.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{q.question_text}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDraft({
                          id: q.id,
                          questionText: q.question_text,
                          options: options.length === 4 ? options : ["", "", "", ""],
                          correctIndex: q.correct_index,
                          explanation: q.explanation ?? "",
                          difficulty: (q.difficulty as Draft["difficulty"]) ?? "medium",
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        await removeQuestion({ data: { id: q.id } });
                        await qc.invalidateQueries({ queryKey: ["questions"] });
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <ul className="mt-2 text-sm">
                  {options.map((o, i) => (
                    <li key={i} className={i === q.correct_index ? "font-semibold text-success" : ""}>
                      {"ABCD"[i]}. {o}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-2xl bg-card p-6 text-card-foreground shadow-xl">
        <h2 className="text-xl font-bold">Amanota y'abanyeshuri</h2>
        <div className="mt-4 space-y-2">
          {(stats?.rows ?? []).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
              <span className="font-semibold">{r.name}</span>
              <span>
                {r.correct_count}/20 · {r.percentage}%
              </span>
              <span className={r.passed ? "font-bold text-success" : "font-bold text-destructive"}>
                {r.passed ? "Watsinze" : "Ntabwo watsinze"}
              </span>
              <span className="text-muted-foreground">{new Date(r.started_at).toLocaleDateString("fr-RW")}</span>
            </div>
          ))}
          {!stats?.rows?.length && <p className="text-sm text-muted-foreground">Nta bizamini birakorwa.</p>}
        </div>
      </section>
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

function Back() {
  return (
    <Link to="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-foreground/80 hover:underline">
      <ArrowLeft className="size-4" /> Ahabanza
    </Link>
  );
}
