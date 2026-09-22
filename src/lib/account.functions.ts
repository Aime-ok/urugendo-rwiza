import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;

    const meta = (claims["user_metadata"] ?? {}) as Record<string, unknown>;
    const metaName = (meta["full_name"] ?? meta["name"] ?? "") as string;
    const metaAvatar = (meta["avatar_url"] ?? meta["picture"] ?? "") as string;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    // Keep the profile in sync with the Google account and stamp the login.
    await supabase
      .from("profiles")
      .update({
        full_name: profile?.full_name || metaName || null,
        avatar_url: metaAvatar || profile?.avatar_url || null,
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");

    return {
      userId,
      fullName: profile?.full_name || metaName || "",
      email: profile?.email ?? (claims["email"] as string | undefined) ?? "",
      avatarUrl: metaAvatar || profile?.avatar_url || "",
      role: isAdmin ? ("admin" as const) : ("user" as const),
      isAdmin,
    };
  });
