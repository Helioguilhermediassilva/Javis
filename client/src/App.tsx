import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import type React from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { LocationProvider } from "./contexts/LocationContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import TelegramConnect from "./pages/TelegramConnect";
import MemorySettings from "./pages/MemorySettings";
import EmailConfirmed from "./pages/EmailConfirmed";

function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  const { t } = useLanguage();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#00060a] text-xs tracking-[0.3em] text-[#00d4ff]">XAVIER / {t("common.session")}</div>;
  }
  return user ? <>{children}</> : <Login />;
}

function ProtectedHome() {
  return <AuthenticatedRoute><Home /></AuthenticatedRoute>;
}

function ProtectedTelegramConnect() {
  return <AuthenticatedRoute><TelegramConnect /></AuthenticatedRoute>;
}

function ProtectedMemorySettings() {
  return <AuthenticatedRoute><MemorySettings /></AuthenticatedRoute>;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={ProtectedHome} />
      <Route path={"/telegram-connect"} component={ProtectedTelegramConnect} />
      <Route path={"/memory"} component={ProtectedMemorySettings} />
      <Route path={"/email-confirmed"} component={EmailConfirmed} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <LanguageProvider>
            <LocationProvider>
              <AuthProvider>
                <Router />
              </AuthProvider>
            </LocationProvider>
          </LanguageProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
