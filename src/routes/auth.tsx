import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Injira — Igira" },
      { name: "description", content: "Injira cyangwa wiyandikishe kuri Igira ukore ibizamini by'amategeko y'umuhanda." },
      { property: "og:title", content: "Injira — Igira" },
      { property: "og:description", content: "Injira kuri Igira ukomeze kwitoza ikizamini cy'uruhushya." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/ahabanza", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/ahabanza", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Reba imeyili yawe wemeze konti yawe.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Habaye ikibazo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Kwinjira na Google byanze.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/ahabanza", replace: true });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md rounded-2xl bg-card p-6 text-card-foreground shadow-xl sm:p-8">
        <h1 className="text-center text-2xl font-bold">
          {mode === "signin" ? "Injira" : "Iyandikishe"}
        </h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Amazina yawe</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-primary">
            {loading ? "Tegereza..." : mode === "signin" ? "Injira" : "Iyandikishe"}
          </Button>
        </form>

        <Button
          variant="outline"
          className="mt-3 w-full border-border bg-card text-card-foreground hover:bg-secondary"
          onClick={handleGoogle}
        >
          Komeza na Google
        </Button>

        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-muted-foreground underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Nta konti ufite? Iyandikishe" : "Usanzwe ufite konti? Injira"}
        </button>
      </div>
    </AppShell>
  );
}
