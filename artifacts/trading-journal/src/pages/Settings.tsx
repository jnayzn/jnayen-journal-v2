import { Copy, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { useMe, useRegenerateToken } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function Settings() {
  const me = useMe();
  const regenerate = useRegenerateToken();
  const [copied, setCopied] = useState(false);

  const token = me.data?.token ?? "";

  const copy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account and API token.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Token</CardTitle>
          <CardDescription>
            Use this token in the MT5 bridge or any external integration.
            Keep it secret.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {me.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs">
              {token}
            </pre>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={copy} disabled={!token}>
              <Copy className="h-4 w-4" />
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => regenerate.mutate()}
              disabled={regenerate.isPending}
            >
              <RefreshCcw className="h-4 w-4" />
              {regenerate.isPending ? "Regenerating…" : "Regenerate token"}
            </Button>
          </div>
          {regenerate.error && (
            <p className="text-sm text-destructive">
              {(regenerate.error as Error).message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {me.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div>
                <span className="text-muted-foreground">Username: </span>
                <span className="font-medium">{me.data?.user.username}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Created: </span>
                <span>
                  {me.data?.user.createdAt
                    ? new Date(me.data.user.createdAt).toLocaleString()
                    : "—"}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
