import { Route, Switch } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { Analytics } from "@/pages/Analytics";
import { Bridge } from "@/pages/Bridge";
import { Calendar } from "@/pages/Calendar";
import { Dashboard } from "@/pages/Dashboard";
import { Login } from "@/pages/Login";
import { NotFound } from "@/pages/NotFound";
import { Register } from "@/pages/Register";
import { Settings } from "@/pages/Settings";
import { Trades } from "@/pages/Trades";

function PrivatePage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/">
        <PrivatePage>
          <Dashboard />
        </PrivatePage>
      </Route>
      <Route path="/trades">
        <PrivatePage>
          <Trades />
        </PrivatePage>
      </Route>
      <Route path="/calendar">
        <PrivatePage>
          <Calendar />
        </PrivatePage>
      </Route>
      <Route path="/analytics">
        <PrivatePage>
          <Analytics />
        </PrivatePage>
      </Route>
      <Route path="/bridge">
        <PrivatePage>
          <Bridge />
        </PrivatePage>
      </Route>
      <Route path="/settings">
        <PrivatePage>
          <Settings />
        </PrivatePage>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}
