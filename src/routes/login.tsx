import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Injira — Urugero Rwiza" },
      {
        name: "description",
        content: "Injira kuri Urugero Rwiza ukoresheje konti ya Google, wige amategeko y'umuhanda.",
      },
      { property: "og:title", content: "Injira — Urugero Rwiza" },
      { property: "og:description", content: "Murakaza neza kuri Urugero Rwiza. Komeza na Google." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Kwinjira na Google byanze. Ongera ugerageze.");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard", replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md rounded-2xl bg-card p-8 text-center text-card-foreground shadow-xl">
        <h1 className="text-3xl font-extrabold tracking-tight">URUGERO RWIZA</h1>
        <p className="mt-2 text-sm text-muted-foreground">Murakaza neza kuri Urugero Rwiza</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Wige amategeko y'umuhanda, witegure neza.
        </p>

        <Button
          className="mt-8 w-full bg-primary text-primary-foreground hover:bg-primary/90"
          size="lg"
          disabled={loading}
          onClick={handleGoogle}
        >
          {loading ? "Tegereza..." : "Komeza na Google"}
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          Nta jambobanga rikenewe. Ukoresha konti yawe ya Google gusa.
        </p>
      </div>
    </AppShell>
  );
}
