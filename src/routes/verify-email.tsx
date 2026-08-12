import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";

import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/verify-email")({ component: VerifyPage });

function VerifyPage() {
  return (
    <AuthShell
      title="Verify your email"
      subtitle="We sent a verification link to your inbox. Click the link to activate your account."
      footer={
        <>
          Wrong email?{" "}
          <Link to="/signup" className="font-medium text-foreground hover:underline">Go back</Link>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 rounded-lg border p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mail className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground">
          Didn't receive it? Check spam or resend below.
        </p>
        <div className="flex gap-2">
          <Button variant="outline">Resend email</Button>
          <Button asChild>
            <Link to="/overview">Continue</Link>
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
