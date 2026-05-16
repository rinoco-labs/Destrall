import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen } from "lucide-react";

type Props = {
  title: string;
  subtitle: string;
  backTo?: string;
  backLabel?: string;
  extra?: ReactNode;
};

export function HelpPageHeader({ title, subtitle, backTo = "/settings", backLabel = "Settings", extra }: Props) {
  return (
    <header className="mb-8">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLabel}
      </Link>
      <div
        className="rounded-2xl border border-primary/15 p-6 backdrop-blur-md"
        style={{
          backgroundImage:
            "linear-gradient(145deg, color-mix(in oklab, var(--brand) 12%, var(--card)) 0%, var(--card) 70%)",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="rounded-xl bg-primary/15 p-3 h-fit">
              <BookOpen className="w-7 h-7 text-brand" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-xl">{subtitle}</p>
            </div>
          </div>
          {extra}
        </div>
      </div>
    </header>
  );
}
