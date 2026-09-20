import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Igira — Kwitegura ikizamini cy'uruhushya rw'agateganyo" },
      {
        name: "description",
        content:
          "Igira ni urubuga rwo kwitoza ikizamini cy'uruhushya rw'agateganyo mu Rwanda: kwiyigisha no gukora ibizamini mu Kinyarwanda.",
      },
      { property: "og:title", content: "Igira — Kwitegura ikizamini cy'uruhushya rw'agateganyo" },
      {
        property: "og:description",
        content: "Kwiyigisha no gukora ibizamini by'amategeko y'umuhanda mu Kinyarwanda.",
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
      if (data.session) navigate({ to: "/ahabanza", replace: true });
    });
  }, [navigate]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-extrabold sm:text-5xl">Igira</h1>
        <p className="mt-3 text-foreground/80">
          Witegure ikizamini cy'uruhushya rw'agateganyo: wiyigishe kandi ukore ibizamini mu Kinyarwanda.
        </p>
        <div className="mt-8">
          <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/auth">Injira / Iyandikishe</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
