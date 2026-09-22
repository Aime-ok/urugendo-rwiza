import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/account.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin Login — Urugero Rwiza" },
      { name: "description", content: "Injira mu buyobozi bwa Urugero Rwiza." },
      { property: "og:title", content: "Admin Login — Urugero Rwiza" },
      { property: "og:description", content: "Urubuga rw'ubuyobozi rwa Urugero Rwiza." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const me = await getMe({});
      if (!me.isAdmin) {
        await supabase.auth.signOut();
        toast.error("Ntufite uburenganzira bwo kwinjira aha.");
        return;
      }
      navigate({ to: "/admin/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kwinjira byanze.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md rounded-2xl bg-card p-8 text-card-foreground shadow-xl">
        <h1 className="text-center text-2xl font-extrabold tracking-tight">URUGERO RWIZA</h1>
        <p className="mt-1 text-center text-sm font-semibold text-muted-foreground">ADMIN LOGIN</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Imeyili</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Ijambobanga</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-primary">
            {loading ? "Tegereza..." : "Injira nka Admin"}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
