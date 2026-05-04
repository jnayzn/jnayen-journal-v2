import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-4 text-center">
        <p className="text-6xl font-bold text-muted-foreground">404</p>
        <p className="text-lg">Page not found.</p>
        <Link href="/">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
