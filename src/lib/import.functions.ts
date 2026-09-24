import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type RpcClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => any;
};

async function assertAdmin(supabase: RpcClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Nta burenganzira bw'ubuyobozi ufite.");
}

const importedQuestion = z.object({
  /** Question number exactly as printed in the PDF. */
  number: z.number().int().min(1),
  page: z.number().int().min(1).optional(),
  questionText: z.string(),
  options: z.array(z.string()).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5).nullable(),
  explanation: z.string().nullable().optional(),
  /** PNG image belonging to this question, base64 without the data: prefix. */
  imageBase64: z.string().nullable().optional(),
  needsReview: z.boolean().default(false),
  rawText: z.string().nullable().optional(),
});

export type ImportedQuestion = z.infer<typeof importedQuestion>;

/**
 * Stores questions exactly as they were read from the PDF.
 * Nothing is rewritten, translated or generated here.
 */
export const importQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        bookId: z.string().uuid(),
        replaceExisting: z.boolean().default(false),
        questions: z.array(importedQuestion).min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    if (data.replaceExisting) {
      await supabase.from("questions").delete().eq("book_id", data.bookId);
    }

    const rows: Array<Record<string, unknown>> = [];

    for (const q of data.questions) {
      let imagePath: string | null = null;
      if (q.imageBase64) {
        const bytes = Uint8Array.from(atob(q.imageBase64), (c) => c.charCodeAt(0));
        const path = `${data.bookId}/q-${String(q.number).padStart(4, "0")}.png`;
        const { error } = await supabase.storage
          .from("question-images")
          .upload(path, bytes, { contentType: "image/png", upsert: true });
        if (!error) imagePath = path;
      }

      const options = q.options.slice(0, 4);
      while (options.length < 4) options.push("");

      rows.push({
        book_id: data.bookId,
        question_text: q.questionText,
        options,
        correct_index: q.correctIndex ?? 0,
        explanation: q.explanation ?? null,
        difficulty: "medium",
        status: q.needsReview ? "draft" : "published",
        needs_review: q.needsReview || q.correctIndex === null,
        source_order: q.number,
        source_page: q.page ?? null,
        raw_text: q.rawText ?? null,
        image_url: imagePath,
        import_source: "pdf",
      });
    }

    const { error } = await supabase.from("questions").insert(rows as never);
    if (error) throw new Error(error.message);

    return { inserted: rows.length };
  });

/** Counters shown on the admin dashboard. */
export const importStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const total = await supabase.from("questions").select("id", { count: "exact", head: true });
    const withImages = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .not("image_url", "is", null);
    const review = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("needs_review", true);

    const totalCount = total.count ?? 0;
    const imageCount = withImages.count ?? 0;
    return {
      total: totalCount,
      withImages: imageCount,
      withoutImages: totalCount - imageCount,
      needsReview: review.count ?? 0,
    };
  });

/** Questions flagged during import, for the admin review list. */
export const listReviewQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("questions")
      .select("id, source_order, source_page, question_text, options, correct_index, raw_text, image_url")
      .eq("needs_review", true)
      .order("source_order", { ascending: true })
      .limit(500);

    const { withSignedImages } = await import("./images.server");
    return withSignedImages(context.supabase, data ?? []);
  });
