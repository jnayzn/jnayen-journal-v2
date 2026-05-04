import { Download } from "lucide-react";
import { useMe } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function Bridge() {
  const me = useMe();
  const token = me.data?.token ?? "<your token>";
  const apiUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api`
      : "https://your-domain/api";

  const downloadScript = async () => {
    const res = await fetch("/api/bridge/script", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      alert(`Failed to download script: ${res.status}`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tradj_bridge.py";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">MT5 Bridge</h1>
        <p className="text-sm text-muted-foreground">
          Sync your MetaTrader 5 trade history into the journal automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Download the bridge script</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            The bridge is a single Python file you run on the same Windows
            machine as your MT5 terminal.
          </p>
          <Button onClick={downloadScript}>
            <Download className="h-4 w-4" /> Download tradj_bridge.py
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Install dependencies</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted/40 p-4 text-xs">
{`pip install MetaTrader5 requests`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Run the bridge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">
              One-shot sync of the last 30 days:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-4 text-xs">
{`python tradj_bridge.py \\
  --api-url ${apiUrl} \\
  --api-token ${token} \\
  --days 30`}
            </pre>
          </div>
          <Separator />
          <div>
            <p className="text-sm text-muted-foreground">
              Daemon mode (poll every 15 seconds):
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-4 text-xs">
{`python tradj_bridge.py \\
  --api-url ${apiUrl} \\
  --api-token ${token} \\
  --watch --interval 15`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>State &amp; deduplication</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The bridge stores its sync progress in{" "}
            <code className="rounded bg-muted px-1">~/.tradj_bridge.json</code>.
            Re-imports are also blocked server-side via a unique
            (user, ticket) constraint, so duplicates are silently skipped.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
