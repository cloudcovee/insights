import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between p-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">Lumen</span>
        </Link>
        <div className="mx-auto w-full max-w-sm py-16">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Lumen Analytics</p>
      </div>
      <div className="relative hidden overflow-hidden border-l bg-muted/30 lg:block">
        <div className="absolute inset-0 flex flex-col justify-center p-16">
          <blockquote className="max-w-md text-xl font-medium leading-relaxed">
            “We replaced three tools with Lumen. Every product engineer opens it daily — and it just
            keeps up.”
          </blockquote>
          <div className="mt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/15 text-sm font-semibold text-primary flex items-center justify-center">MR</div>
            <div>
              <div className="text-sm font-medium">Mira Reyes</div>
              <div className="text-xs text-muted-foreground">Head of Product, Meridian</div>
            </div>
          </div>
          <div className="mt-16 grid grid-cols-3 gap-4 text-xs text-muted-foreground">
            <div>
              <div className="text-2xl font-semibold text-foreground">3.4B</div>
              events tracked / mo
            </div>
            <div>
              <div className="text-2xl font-semibold text-foreground">99.99%</div>
              uptime SLA
            </div>
            <div>
              <div className="text-2xl font-semibold text-foreground">120ms</div>
              median query time
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
