import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { shuffle } from "./shuffle";
import { z } from "zod";

export type StudyQuestion = {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  difficulty: string;
};

export const getStudyQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mode: z.enum(["new", "review", "continue"]) }).parse(d))
  .handler(async ({ data, context }): Promise<StudyQuestion[]> => {
    const { supabase, userId } = context;

    const { data: history } = await supabase
      .from("learner_question_history")
      .select("question_id, last_correct")
      .eq("user_id", userId);

    const seen = new Set((history ?? []).map((h) => h.question_id));
    const wrong = new Set((history ?? []).filter((h) => h.last_correct === false).map((h) => h.question_id));

    const { data: all } = await supabase
      .from("questions")
      .select("id, question_text, options, correct_index, explanation, difficulty, image_url")
      .limit(1000);

    const { withSignedImages } = await import("./images.server");
    const signedAll = await withSignedImages(supabase, all ?? []);

    const questions = signedAll.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      options: (q.options as unknown as string[]) ?? [],
      correct_index: q.correct_index,
      explanation: q.explanation,
      difficulty: q.difficulty,
      image_url: q.image_url,
    }));

    let pool: StudyQuestion[];
    if (data.mode === "review") {
      pool = shuffle(questions.filter((q) => seen.has(q.id)));
    } else if (data.mode === "new") {
      pool = shuffle(questions.filter((q) => !seen.has(q.id)));
      if (pool.length === 0) pool = shuffle(questions);
    } else {
      const unseen = shuffle(questions.filter((q) => !seen.has(q.id)));
      const toFix = shuffle(questions.filter((q) => wrong.has(q.id)));
      pool = [...unseen, ...toFix];
      if (pool.length === 0) pool = shuffle(questions);
    }

    return pool.slice(0, 20);
  });

export const recordStudyAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ questionId: z.string().uuid(), correct: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("learner_question_history")
      .select("id, times_seen, times_correct")
      .eq("user_id", userId)
      .eq("question_id", data.questionId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("learner_question_history")
        .update({
          times_seen: existing.times_seen + 1,
          times_correct: existing.times_correct + (data.correct ? 1 : 0),
          last_correct: data.correct,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("learner_question_history").insert({
        user_id: userId,
        question_id: data.questionId,
        times_seen: 1,
        times_correct: data.correct ? 1 : 0,
        last_correct: data.correct,
      });
    }
    return { ok: true };
  });

export const getProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: history } = await supabase
      .from("learner_question_history")
      .select("times_seen, times_correct, last_correct")
      .eq("user_id", userId);

    const { count: totalQuestions } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true });

    const { data: attempts } = await supabase
      .from("exam_attempts")
      .select("correct_count, percentage, passed")
      .eq("user_id", userId)
      .eq("completed", true);

    const seenList = history ?? [];
    const answered = seenList.reduce((s, h) => s + h.times_seen, 0);
    const correct = seenList.reduce((s, h) => s + h.times_correct, 0);

    const best = (attempts ?? []).reduce((m, a) => Math.max(m, a.correct_count), 0);

    return {
      questionsSeen: seenList.length,
      answered,
      correct,
      wrong: answered - correct,
      exams: (attempts ?? []).length,
      bestScore: best,
      totalQuestions: totalQuestions ?? 0,
      coverage: totalQuestions ? Math.round((seenList.length / totalQuestions) * 100) : 0,
    };
  });
