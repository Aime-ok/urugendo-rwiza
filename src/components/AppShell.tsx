import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function Logo() {
  return (
    <Link to="/" className="flex items-center justify-center gap-3">
      <span className="rounded-md bg-accent px-3 py-1 text-2xl font-extrabold tracking-tight text-accent-foreground">
        Igira
      </span>
      <span className="text-left text-xs font-bold leading-tight text-foreground sm:text-sm">
        Rwanda Provisional
        <br />
        Driving Test Practice
      </span>
    </Link>
  );
}

export function AppShell({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto w-full max-w-5xl px-4 pt-8">
        <div className="relative flex items-center justify-center">
          <Logo />
          <div className="absolute right-0">{right}</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>

      <footer className="mt-8">
        <p className="pb-4 text-center text-xs text-foreground/70">
          Powered by iNEX Technology Service Ltd
        </p>
        <div className="checker-strip" />
      </footer>
    </div>
  );
}
