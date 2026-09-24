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

export const uploadBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().min(1).max(200),
        fileBase64: z.string().min(10),
        content: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const binary = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
    const content = data.content.replace(/[ \t]+\n/g, "\n").trim();

    if (content.length < 200) {
      throw new Error("Iki gitabo nta nyandiko gishoboye gusomwamo. Koresha PDF ifite inyandiko (atari amafoto).");
    }

    const path = `${userId}/${Date.now()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("books")
      .upload(path, binary, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(upErr.message);

    await supabase.from("books").update({ is_active: false }).eq("is_active", true);

    const { data: book, error } = await supabase
      .from("books")
      .insert({ title: data.title, storage_path: path, content, is_active: true, created_by: userId })
      .select("id, title, created_at")
      .single();
    if (error) throw new Error(error.message);

    return { book, characters: content.length };
  });

export const listBooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("books")
      .select("id, title, is_active, created_at, storage_path")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const setActiveBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bookId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await context.supabase.from("books").update({ is_active: false }).eq("is_active", true);
    const { error } = await context.supabase.from("books").update({ is_active: true }).eq("id", data.bookId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bookId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: book } = await context.supabase
      .from("books")
      .select("storage_path")
      .eq("id", data.bookId)
      .maybeSingle();
    if (book?.storage_path) await context.supabase.storage.from("books").remove([book.storage_path]);
    const { error } = await context.supabase.from("books").delete().eq("id", data.bookId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Temporary link so the admin can always open the original source PDF. */
export const getBookFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bookId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: book } = await context.supabase
      .from("books")
      .select("storage_path")
      .eq("id", data.bookId)
      .maybeSingle();
    if (!book?.storage_path) throw new Error("Iyi dosiye ntibonetse.");
    const { data: signed } = await context.supabase.storage
      .from("books")
      .createSignedUrl(book.storage_path, 60 * 30);
    if (!signed?.signedUrl) throw new Error("Gufungura dosiye byanze.");
    return { url: signed.signedUrl };
  });

export const listQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("questions")
      .select(
        "id, question_text, options, correct_index, explanation, difficulty, topic, book_id, image_url, source_order, needs_review",
      )
      .order("source_order", { ascending: true, nullsFirst: false })
      .limit(500);

    const { withSignedImages } = await import("./images.server");
    return withSignedImages(context.supabase, data ?? []);
  });

const questionInput = z.object({
  id: z.string().uuid().optional(),
  bookId: z.string().uuid().nullable().optional(),
  questionText: z.string().min(5),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});

export const saveQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => questionInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const row = {
      question_text: data.questionText,
      options: data.options,
      correct_index: data.correctIndex,
      explanation: data.explanation ?? null,
      difficulty: data.difficulty,
      book_id: data.bookId ?? null,
    };
    const q = data.id
      ? await context.supabase.from("questions").update(row).eq("id", data.id)
      : await context.supabase.from("questions").insert(row);
    if (q.error) throw new Error(q.error.message);
    return { ok: true };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: attempts } = await supabaseAdmin
      .from("exam_attempts")
      .select("id, user_id, started_at, correct_count, wrong_count, percentage, passed, completed")
      .eq("completed", true)
      .order("started_at", { ascending: false })
      .limit(100);

    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, email");
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    const rows = (attempts ?? []).map((a) => ({
      ...a,
      name: byId.get(a.user_id)?.full_name ?? byId.get(a.user_id)?.email ?? "Umunyeshuri",
    }));

    const { count: learners } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    const { count: questions } = await supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true });

    const passed = rows.filter((r) => r.passed).length;
    return {
      rows,
      learners: learners ?? 0,
      questions: questions ?? 0,
      exams: rows.length,
      passRate: rows.length ? Math.round((passed / rows.length) * 100) : 0,
    };
  });
