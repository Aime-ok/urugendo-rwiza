import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getMe } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    try {
      const me = await getMe({});
      if (!me.isAdmin) throw redirect({ to: "/dashboard", replace: true });
      return { me };
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) throw error;
      throw redirect({ to: "/dashboard", replace: true });
    }
  },
  component: () => <Outlet />,
});
