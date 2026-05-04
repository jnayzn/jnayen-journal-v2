import { TerminalSquare } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useRegister } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

export function Register() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const registerMutation = useRegister();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await registerMutation.mutateAsync({ username, password });
    login(res);
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <TerminalSquare className="h-5 w-5 text-primary" />
          <span className="text-sm tracking-tight">jnayen.tradej / register</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Create account</CardTitle>
            <CardDescription>
              Pick a username and password (min. 8 characters).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              {registerMutation.error && (
                <p className="text-sm text-destructive">
                  {(registerMutation.error as Error).message}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "Creating…" : "Create account"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login">
                <a className="text-primary hover:underline">Sign in</a>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
