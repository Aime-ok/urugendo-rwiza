import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { shuffle } from "./shuffle";
import { z } from "zod";

export const EXAM_SIZE = 20;
export const PASS_MARK = 12;

export const startExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: all } = await supabase
      .from("questions")
      .select("id, question_text, options, difficulty, image_url")
      .limit(1000);

    const questions = all ?? [];
    if (questions.length < EXAM_SIZE) {
      throw new Error(
        `Nta bibazo bihagije birahari (${questions.length}/${EXAM_SIZE}). Umuyobozi agomba gushyiraho igitabo no gukora ibibazo.`,
      );
    }

    const { data: history } = await supabase
      .from("learner_question_history")
      .select("question_id")
      .eq("user_id", userId);
    const seen = new Set((history ?? []).map((h) => h.question_id));

    const unseen = shuffle(questions.filter((q) => !seen.has(q.id)));
    const rest = shuffle(questions.filter((q) => seen.has(q.id)));
    const chosen = [...unseen, ...rest].slice(0, EXAM_SIZE);
    const ordered = shuffle(chosen);

    const { data: attempt, error } = await supabase
      .from("exam_attempts")
      .insert({ user_id: userId, mode: "exam", total: EXAM_SIZE })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("attempt_answers").insert(
      ordered.map((q, i) => ({
        attempt_id: attempt.id,
        user_id: userId,
        question_id: q.id,
        order_index: i,
      })),
    );

    const { withSignedImages } = await import("./images.server");
    const signed = await withSignedImages(supabase, ordered);

    return {
      attemptId: attempt.id as string,
      questions: signed.map((q) => ({
        id: q.id,
        question_text: q.question_text,
        options: (q.options as unknown as string[]) ?? [],
        image_url: q.image_url,
      })),
    };
  });

export const submitExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        attemptId: z.string().uuid(),
        answers: z.array(
          z.object({ questionId: z.string().uuid(), selectedIndex: z.number().int().min(-1).max(3) }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const ids = data.answers.map((a) => a.questionId);
    const { data: questions } = await supabase
      .from("questions")
      .select("id, correct_index")
      .in("id", ids);
    const correctBy = new Map((questions ?? []).map((q) => [q.id, q.correct_index]));

    let correct = 0;
    const now = new Date().toISOString();

    for (const a of data.answers) {
      const isCorrect = a.selectedIndex >= 0 && correctBy.get(a.questionId) === a.selectedIndex;
      if (isCorrect) correct++;

      await supabase
        .from("attempt_answers")
        .update({
          selected_index: a.selectedIndex >= 0 ? a.selectedIndex : null,
          is_correct: isCorrect,
          answered_at: now,
        })
        .eq("attempt_id", data.attemptId)
        .eq("question_id", a.questionId);

      const { data: existing } = await supabase
        .from("learner_question_history")
        .select("id, times_seen, times_correct")
        .eq("user_id", userId)
        .eq("question_id", a.questionId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("learner_question_history")
          .update({
            times_seen: existing.times_seen + 1,
            times_correct: existing.times_correct + (isCorrect ? 1 : 0),
            last_correct: isCorrect,
            last_seen_at: now,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("learner_question_history").insert({
          user_id: userId,
          question_id: a.questionId,
          times_seen: 1,
          times_correct: isCorrect ? 1 : 0,
          last_correct: isCorrect,
        });
      }
    }

    const total = data.answers.length || EXAM_SIZE;
    const wrong = total - correct;
    const percentage = Math.round((correct / total) * 100);
    const passed = correct >= PASS_MARK;

    await supabase
      .from("exam_attempts")
      .update({
        finished_at: now,
        completed: true,
        total,
        correct_count: correct,
        wrong_count: wrong,
        percentage,
        passed,
      })
      .eq("id", data.attemptId)
      .eq("user_id", userId);

    return { correct, wrong, total, percentage, passed };
  });

export const getExamHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("exam_attempts")
      .select("id, started_at, finished_at, total, correct_count, wrong_count, percentage, passed")
      .eq("user_id", context.userId)
      .eq("completed", true)
      .order("started_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const getAttemptReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ attemptId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: answers } = await context.supabase
      .from("attempt_answers")
      .select("order_index, selected_index, is_correct, question_id")
      .eq("attempt_id", data.attemptId)
      .eq("user_id", context.userId)
      .order("order_index");

    const ids = (answers ?? []).map((a) => a.question_id);
    const { data: questions } = await context.supabase
      .from("questions")
      .select("id, question_text, options, correct_index, explanation, image_url")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const { withSignedImages } = await import("./images.server");
    const signedQuestions = await withSignedImages(context.supabase, questions ?? []);
    const byId = new Map(signedQuestions.map((q) => [q.id, q]));

    return (answers ?? []).map((a) => {
      const q = byId.get(a.question_id);
      return {
        questionId: a.question_id,
        questionText: q?.question_text ?? "",
        options: ((q?.options as unknown as string[]) ?? []),
        correctIndex: q?.correct_index ?? 0,
        explanation: q?.explanation ?? null,
        imageUrl: q?.image_url ?? null,
        selectedIndex: a.selected_index,
        isCorrect: a.is_correct ?? false,
      };
    });
  });
