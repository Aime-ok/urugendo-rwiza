import { createFileRoute } from "@tanstack/react-router";
import { createInitialAdmin } from "@/lib/setup.functions";

export const Route = createFileRoute("/api/public/setup-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { email: string; password: string };
        try {
          const res = await createInitialAdmin({ data: body });
          return Response.json(res);
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 });
        }
      },
    },
  },
});
