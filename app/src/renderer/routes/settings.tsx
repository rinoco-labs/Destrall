import { createFileRoute, /* Link, */ useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  // Bell,
  ChevronRight,
  Zap,
  // DollarSign,
  Info,
  LogOut,
  ShieldCheck,
  Timer,
  Key,
  // Boxes,
  Palette,
  Languages,
  Sparkles,
  Globe,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLogo } from "@/components/branding/AppLogo";
import { ThemeSelector } from "@/components/settings/ThemeSelector";
import { SelectModal } from "@/components/settings/SelectModal";
import { AutoLockModal } from "@/components/settings/AutoLockModal";
import { RecoveryPhraseModal } from "@/components/settings/RecoveryPhraseModal";
import { AiModelModal } from "@/components/settings/AiModelModal";
import {
  useSettingsStore,
  SUPPORTED_LANGUAGES,
  // SUPPORTED_CURRENCIES,
  AUTO_LOCK_OPTIONS,
  AI_PERSONALITIES,
  type AppLanguage,
  // type AppCurrency,
  type AiPersonality,
} from "@/stores/settingsStore";
import { useAiModelStore } from "@/stores/aiModelStore";
import { useWalletStore } from "@/stores/walletStore";
import { useNetworkStore } from "@/stores/networkStore";
import type { SuiChainEnvironment } from "../../config/chains/sui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings — Destrall" },
      { name: "description", content: "Manage your Destrall preferences, security, and AI." },
    ],
  }),
});

type RowProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  destructive?: boolean;
  highlight?: boolean;
  onClick?: () => void;
};

function AssistantBrandIcon({ className }: { className?: string }) {
  return (
    <span className={className}>
      <AppLogo variant="mark" size="sm" />
    </span>
  );
}

function SettingRow({ icon: Icon, label, value, destructive, highlight, onClick }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-secondary/40 transition ${
        destructive ? "text-destructive" : ""
      }`}
    >
      <Icon
        className={`w-5 h-5 ${
          highlight
            ? "text-brand"
            : destructive
              ? "text-destructive"
              : "text-muted-foreground"
        }`}
      />
      <span className="flex-1 text-sm font-medium">{label}</span>
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
      {!destructive && <ChevronRight className="w-4 h-4 text-muted-foreground/60" />}
    </button>
  );
}

type ModalKind = null | "language" | /* "currency" | */ "autoLock" | "aiModel" | "personality" | "network";

function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [openModal, setOpenModal] = useState<ModalKind>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const lockWallet = useWalletStore((s) => s.lockWallet);
  const disconnectWallet = useWalletStore((s) => s.disconnectWallet);

  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  // const currency = useSettingsStore((s) => s.currency);
  // const setCurrency = useSettingsStore((s) => s.setCurrency);
  const autoLockMinutes = useSettingsStore((s) => s.autoLockMinutes);
  const setAutoLockMinutes = useSettingsStore((s) => s.setAutoLockMinutes);
  const refreshAiModels = useAiModelStore((s) => s.refreshFromMain);
  const isDownloaded = useAiModelStore((s) => s.isDownloaded);
  const isDownloading = useAiModelStore((s) => s.isDownloading);
  const isLoading = useAiModelStore((s) => s.isLoading);
  const isLoaded = useAiModelStore((s) => s.isLoaded);
  const aiError = useAiModelStore((s) => s.error);

  const initializeNetwork = useNetworkStore((s) => s.initializeNetworkState);
  const network = useNetworkStore((s) => s.network);
  const setSuiEnvironment = useNetworkStore((s) => s.setSuiEnvironment);

  useEffect(() => {
    void initializeNetwork();
  }, [initializeNetwork]);

  useEffect(() => {
    void refreshAiModels();
  }, [refreshAiModels]);

  const aiPersonality = useSettingsStore((s) => s.aiPersonality);
  const setAiPersonality = useSettingsStore((s) => s.setAiPersonality);

  const langLabel = SUPPORTED_LANGUAGES.find((l) => l.code === language)?.native ?? language;
  // const currencyLabel = currency;
  const autoLockLabel =
    AUTO_LOCK_OPTIONS.find((a) => a.value === autoLockMinutes)?.label ?? `${autoLockMinutes} min`;
  const aiStatusLabel = (() => {
    if (aiError && !isDownloading && !isLoading) return t("settings.aiStatusError", "Error");
    if (isDownloading) return t("settings.aiStatusDownloading", "Downloading");
    if (isLoading) return t("settings.aiStatusLoading", "Loading");
    if (isLoaded) return t("settings.aiStatusLoaded", "Loaded");
    if (isDownloaded) return t("settings.aiStatusReady", "Ready");
    return t("settings.aiStatusNotDownloaded", "Not downloaded");
  })();
  const personalityLabel =
    AI_PERSONALITIES.find((p) => p.id === aiPersonality)?.name ?? aiPersonality;

  const networkLabel = network
    ? `${network.activeEnvironment.charAt(0).toUpperCase()}${network.activeEnvironment.slice(1)}`
    : "—";

  const NETWORK_OPTIONS: { value: SuiChainEnvironment; label: string; description: string }[] = [
    { value: "mainnet", label: "Mainnet", description: "Production Sui network" },
    { value: "testnet", label: "Testnet", description: "Sui test network" },
    { value: "devnet", label: "Devnet", description: "Sui developer network" },
  ];

  const handleLock = async () => {
    await lockWallet();
    navigate({ to: "/lock" });
  };

  const handleLogOut = async () => {
    setLogoutError(null);
    setIsLoggingOut(true);
    try {
      await disconnectWallet();
      setLogoutConfirmOpen(false);
      navigate({ to: "/" });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Could not log out");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const openLogoutConfirm = () => {
    setLogoutError(null);
    setLogoutConfirmOpen(true);
  };

  return (
    <AppShell active="settings">
      <div className="max-w-3xl mx-auto w-full px-2">
        <div className="flex items-center gap-3 mb-8">
          <AppLogo variant="icon" size="lg" />
          <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
        </div>

        {/* Appearance */}
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">
          {t("settings.appearance")}
        </p>
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur divide-y divide-border overflow-hidden mb-8">
          <div className="flex items-center gap-4 px-5 py-4 flex-wrap">
            <Palette className="w-5 h-5 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">{t("settings.theme")}</span>
            <ThemeSelector />
          </div>
          <SettingRow
            icon={Languages}
            label={t("settings.language")}
            value={langLabel}
            onClick={() => setOpenModal("language")}
          />
        </div>

        {/* General */}
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">
          {t("settings.general")}
        </p>
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur divide-y divide-border overflow-hidden mb-8">
          {/* <Link
            to="/store"
            search={{ tab: "installed" }}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-secondary/40 transition"
          >
            <Boxes className="w-5 h-5 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">
              {t("settings.installedPackages")}
            </span>
            <span className="text-sm text-muted-foreground">{t("settings.manage")}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
          </Link> */}
          <SettingRow
            icon={Globe}
            label="Sui network"
            value={networkLabel}
            onClick={() => setOpenModal("network")}
          />
          {/* <SettingRow
            icon={DollarSign}
            label={t("settings.currency")}
            value={currencyLabel}
            onClick={() => setOpenModal("currency")}
          /> */}
          {/* <SettingRow
            icon={Bell}
            label={t("settings.notifications")}
            value={t("settings.on")}
          /> */}
          {/* <SettingRow
            icon={ShieldCheck}
            label={t("settings.developerMode")}
            value={t("settings.on")}
          /> */}
          <Link
            to="/triggers"
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-secondary/40 transition"
          >
            <Zap className="w-5 h-5 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">Automation triggers</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
          </Link>
          <Link
            to="/how-it-works"
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-secondary/40 transition"
          >
            <Info className="w-5 h-5 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">How It Works</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
          </Link>
          <Link
            to="/assistant-tools"
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-secondary/40 transition"
          >
            <AppLogo variant="mark" size="sm" />
            <span className="flex-1 text-sm font-medium">Assistant Tools</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
          </Link>
          <SettingRow icon={Info} label={t("settings.version")} value="1.0.0" />
        </div>

        {/* Security */}
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">
          {t("settings.security")}
        </p>
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur divide-y divide-border overflow-hidden mb-8">
          <SettingRow
            icon={Timer}
            label={t("settings.autoLockTimeout")}
            value={autoLockLabel}
            onClick={() => setOpenModal("autoLock")}
          />
          <SettingRow
            icon={Key}
            label={t("settings.recoveryPhrase")}
            onClick={() => setRecoveryOpen(true)}
          />
          <SettingRow
            icon={ShieldCheck}
            label={t("settings.lockAppNow")}
            highlight
            onClick={() => void handleLock()}
          />
        </div>

        {/* AI */}
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">
          {t("settings.ai")}
        </p>
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur divide-y divide-border overflow-hidden mb-8">
          <SettingRow
            icon={AssistantBrandIcon}
            label={t("settings.assistantAi", "Assistant AI")}
            value={aiStatusLabel}
            onClick={() => setOpenModal("aiModel")}
          />
          <SettingRow
            icon={Sparkles}
            label={t("settings.personality")}
            value={personalityLabel}
            onClick={() => setOpenModal("personality")}
          />
        </div>

        <div className="mt-10 mb-12">
          <button
            type="button"
            onClick={openLogoutConfirm}
            disabled={isLoggingOut}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive font-semibold py-4 hover:bg-destructive/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-5 h-5" />
            {t("settings.logOut")}
          </button>
        </div>
      </div>

      <AlertDialog
        open={logoutConfirmOpen}
        onOpenChange={(open) => {
          if (!isLoggingOut) {
            setLogoutConfirmOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.logOutConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left text-sm text-muted-foreground">
                <p>{t("settings.logOutConfirmDescription")}</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>{t("settings.logOutConfirmEncryptedVault")}</li>
                  <li>{t("settings.logOutConfirmAccounts")}</li>
                  <li>{t("settings.logOutConfirmOnboarding")}</li>
                </ul>
                <p>{t("settings.logOutConfirmRecoveryWarning")}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {logoutError && <p className="text-sm text-destructive">{logoutError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isLoggingOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleLogOut();
              }}
            >
              {isLoggingOut ? t("settings.logOutInProgress") : t("settings.logOutConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modals */}
      <SelectModal<AppLanguage>
        open={openModal === "language"}
        onOpenChange={(o) => !o && setOpenModal(null)}
        title={t("settings.language")}
        description={t("settings.chooseLanguage", "Choose your preferred language.")}
        value={language}
        options={SUPPORTED_LANGUAGES.map((l) => ({
          value: l.code,
          label: l.native,
          description: l.label,
        }))}
        onSelect={setLanguage}
      />

      {/* <SelectModal<AppCurrency>
        open={openModal === "currency"}
        onOpenChange={(o) => !o && setOpenModal(null)}
        title={t("settings.currency")}
        description={t("settings.chooseCurrency", "Choose the currency used to display balances.")}
        value={currency}
        options={SUPPORTED_CURRENCIES.map((c) => ({
          value: c.code,
          label: `${c.code} — ${c.label}`,
          description: `Symbol: ${c.symbol}`,
        }))}
        onSelect={setCurrency}
      /> */}

      <AutoLockModal
        open={openModal === "autoLock"}
        onOpenChange={(o) => !o && setOpenModal(null)}
        value={autoLockMinutes}
        onSelect={setAutoLockMinutes}
      />

      <AiModelModal
        open={openModal === "aiModel"}
        onOpenChange={(o) => !o && setOpenModal(null)}
        title={t("settings.assistantAi", "Assistant AI")}
        description={t(
          "settings.assistantAiDescription",
          "Download, reload, or remove the on-device assistant.",
        )}
      />

      <SelectModal<AiPersonality>
        open={openModal === "personality"}
        onOpenChange={(o) => !o && setOpenModal(null)}
        title={t("settings.personality")}
        description={t(
          "settings.choosePersonality",
          "Pick how the assistant should communicate with you.",
        )}
        value={aiPersonality}
        options={AI_PERSONALITIES.map((p) => ({
          value: p.id,
          label: p.name,
          description: p.description,
        }))}
        onSelect={setAiPersonality}
      />

      <SelectModal<SuiChainEnvironment>
        open={openModal === "network"}
        onOpenChange={(o) => !o && setOpenModal(null)}
        title="Sui network"
        description="Balances, activity, sends, and assistant chain context use this RPC cluster."
        value={network?.activeEnvironment ?? "mainnet"}
        options={NETWORK_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          description: o.description,
        }))}
        onSelect={(env) => {
          void setSuiEnvironment(env);
        }}
      />

      <RecoveryPhraseModal open={recoveryOpen} onOpenChange={setRecoveryOpen} />
    </AppShell>
  );
}
