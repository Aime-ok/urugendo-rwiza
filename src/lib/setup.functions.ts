import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * One-time bootstrap of the single administrator account.
 * Refuses to run once any admin exists, so it cannot be used to gain access later.
 */
export const createInitialAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().email(), password: z.string().min(12) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) > 0) throw new Error("Umuyobozi asanzwe ahari.");

    const email = data.email.toLowerCase();
    let userId: string | null = null;

    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: "Admin" },
    });

    if (created.data.user) {
      userId = created.data.user.id;
    } else {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
      if (!existing) throw new Error(created.error?.message ?? "Konti ntiyashoboye gukorwa.");
      userId = existing.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
      });
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email, full_name: "Admin" }, { onConflict: "id" });

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);

    return { ok: true, userId };
  });
