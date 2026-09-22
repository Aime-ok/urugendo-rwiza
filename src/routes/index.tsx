import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Urugero Rwiza — Kwitegura ikizamini cy'uruhushya" },
      {
        name: "description",
        content:
          "Urugero Rwiza ni urubuga rwo kwitoza ikizamini cy'uruhushya rw'agateganyo mu Rwanda: wige amategeko y'umuhanda, witegure neza.",
      },
      { property: "og:title", content: "Urugero Rwiza — Kwitegura ikizamini cy'uruhushya" },
      {
        property: "og:description",
        content: "Wige amategeko y'umuhanda, witegure neza. Ibizamini mu Kinyarwanda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">URUGERO RWIZA</h1>
        <p className="mt-3 text-foreground/80">Wige amategeko y'umuhanda, witegure neza.</p>
        <div className="mt-8">
          <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/login">Injira</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
