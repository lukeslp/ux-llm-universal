import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Router, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ChatProvider } from "./contexts/ChatContext";
import Home from "./pages/Home";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "") || "";

function AppRouter() {
  return (
    <Router base={BASE}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider>
          <ChatProvider>
            <Toaster />
            <AppRouter />
          </ChatProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
