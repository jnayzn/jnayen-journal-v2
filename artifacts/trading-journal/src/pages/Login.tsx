import { TerminalSquare } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin } from "@/api/hooks";
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

export function Login() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const loginMutation = useLogin();
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("demo1234");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await loginMutation.mutateAsync({ username, password });
    login(res);
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <TerminalSquare className="h-5 w-5 text-primary" />
          <span className="text-sm tracking-tight">jnayen.tradej / login</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Use the demo account or your own credentials.
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {loginMutation.error && (
                <p className="text-sm text-destructive">
                  {(loginMutation.error as Error).message}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              No account?{" "}
              <Link href="/register">
                <a className="text-primary hover:underline">Create one</a>
              </Link>
            </div>
            <div className="mt-2 text-center text-xs text-muted-foreground">
              demo / demo1234
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
