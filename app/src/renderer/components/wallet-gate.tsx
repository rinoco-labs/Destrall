import { useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useWalletStore } from "@/stores/walletStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { AppLogo } from "@/components/branding/AppLogo";
import { BRANDING } from "@config/branding";

export function WalletGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const restoreStatus = useWalletStore((s) => s.restoreStatus);
  const hasVault = useWalletStore((s) => s.hasVault);
  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const initializeWalletState = useWalletStore((s) => s.initializeWalletState);
  const onboardingComplete = useOnboardingStore((s) => s.onboardingComplete);

  useEffect(() => {
    if (restoreStatus === "idle") {
      void initializeWalletState();
    }
  }, [initializeWalletState, restoreStatus]);

  useEffect(() => {
    if (restoreStatus !== "ready") return;

    const path = location.pathname;

    if (!hasVault) {
      if (path !== "/") {
        navigate({ to: "/" });
      }
      return;
    }

    if (!isUnlocked) {
      if (path !== "/lock") {
        navigate({ to: "/lock" });
      }
      return;
    }

    if (path === "/lock" || (path === "/" && onboardingComplete)) {
      navigate({ to: "/home" });
    }
  }, [hasVault, isUnlocked, location.pathname, navigate, onboardingComplete, restoreStatus]);

  if (restoreStatus === "loading" || restoreStatus === "idle") {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <AppLogo variant="icon" size="xl" />
        <p className="text-sm text-muted-foreground">Restoring {BRANDING.appName}…</p>
      </div>
    );
  }

  return <>{children}</>;
}
