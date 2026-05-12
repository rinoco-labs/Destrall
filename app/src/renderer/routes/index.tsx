import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Moon,
  PlusCircle,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useAiStore } from "@/stores/aiStore";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Set Up Your Wallet — Vault" },
      { name: "description", content: "Create a multi-chain wallet and choose your local AI assistant." },
    ],
  }),
});

function Asterisk({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 2v20M4.2 6.2l15.6 11.6M4.2 17.8L19.8 6.2M2 12h20"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Step =
  | "choose"
  | "phrase"
  | "import"
  | "password"
  | "confirm"
  | "created"
  | "model";

type Flow = "create" | "import";

const STEP_ORDER: Step[] = ["phrase", "password", "confirm", "created"];
const IMPORT_STEP_ORDER: Step[] = ["import", "password", "confirm", "created"];

const SAMPLE_PHRASE = [
  "harbor", "violet", "orbit", "candle",
  "meadow", "syrup", "puzzle", "ember",
  "lantern", "ribbon", "marble", "quartz",
];

const MODELS = [
  {
    id: "qwen",
    tier: "Balanced",
    name: "Qwen2.5 3B Instruct (Q4_K_M)",
    size: "~2.0 GB",
    description: "Strong instruction-following with moderate hardware requirements.",
  },
  {
    id: "gemma",
    tier: "High Quality",
    name: "Gemma 4 E2B IT (Q4_0)",
    size: "3.04 GB",
    description: "Quality-focused model for deeper reasoning and planning.",
  },
];

function Index() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { theme, toggle: toggleTheme } = useTheme();
  const setOnboardingComplete = useOnboardingStore((s) => s.setOnboardingComplete);
  const setWalletSetupComplete = useOnboardingStore((s) => s.setWalletSetupComplete);
  const setAiSetupComplete = useOnboardingStore((s) => s.setAiModelSetupComplete);
  const aiMarkInstalled = useAiStore((s) => s.markInstalled);
  const aiSelect = useAiStore((s) => s.selectModel);
  const [step, setStep] = useState<Step>("choose");
  const [flow, setFlow] = useState<Flow>("create");
  const [seedInput, setSeedInput] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});

  const address = useMemo(
    () =>
      Array.from({ length: 44 }, () =>
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789".charAt(
          Math.floor(Math.random() * 57),
        ),
      ).join(""),
    [],
  );

  const activeOrder = flow === "import" ? IMPORT_STEP_ORDER : STEP_ORDER;
  const stepIndex = activeOrder.indexOf(step as (typeof activeOrder)[number]);

  const goBack = () => {
    if (step === "phrase" || step === "import") setStep("choose");
    else if (step === "password") setStep(flow === "import" ? "import" : "phrase");
    else if (step === "confirm") setStep("password");
    else if (step === "created") setStep("confirm");
    else if (step === "model") setStep("created");
  };

  const copyPhrase = async () => {
    try {
      await navigator.clipboard.writeText(SAMPLE_PHRASE.join(" "));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  const submitPassword = () => {
    if (password.length < 8) {
      setPwdError(t("onboarding.passwordTooShort"));
      return;
    }
    setPwdError(null);
    setStep("confirm");
  };

  const submitConfirm = () => {
    if (confirm !== password) {
      setPwdError(t("onboarding.passwordsDoNotMatch"));
      return;
    }
    setPwdError(null);
    setWalletSetupComplete(true);
    setStep("created");
  };

  const startDownload = (id: string) => {
    setDownloading(id);
    setTimeout(() => {
      setDownloading(null);
      setDownloaded((d) => ({ ...d, [id]: true }));
      setSelectedModel(id);
      aiMarkInstalled(id);
      aiSelect(id);
    }, 1400);
  };

  const finish = () => {
    setAiSetupComplete(true);
    setOnboardingComplete(true);
    navigate({ to: "/home" });
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-background px-4 py-10 relative">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={t("settings.theme")}
        className="absolute top-5 right-5 z-10 inline-flex items-center justify-center rounded-full border border-border bg-card/70 backdrop-blur w-10 h-10 text-foreground hover:bg-card transition shadow-sm"
      >
        {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
      <div
        className="w-full max-w-5xl rounded-3xl bg-card overflow-hidden grid md:grid-cols-2"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        {/* Left panel */}
        <div
          className="relative hidden md:flex flex-col justify-between p-8 m-3 rounded-2xl text-white min-h-[560px]"
          style={{ background: "var(--gradient-brand)" }}
        >
          <Asterisk className="w-8 h-8 text-white" />
          <div className="space-y-2">
            <p className="text-sm/relaxed opacity-90">You can easily</p>
            <h2 className="text-2xl font-semibold leading-snug max-w-[18rem]">
              Get access your personal hub for clarity and productivity
            </h2>
          </div>
          <div className="absolute inset-0 rounded-2xl ring-1 ring-white/20 pointer-events-none" />
        </div>

        {/* Right panel */}
        <div className="p-8 sm:p-12 flex flex-col justify-center min-h-[560px]">
          {step === "choose" && (
            <ChooseStep
              onCreate={() => {
                setFlow("create");
                setStep("phrase");
              }}
              onImport={() => {
                setFlow("import");
                setStep("import");
              }}
            />
          )}

          {step !== "choose" && step !== "model" && (
            <div className="flex items-center gap-3 mb-8">
              <button
                type="button"
                onClick={goBack}
                aria-label={t("common.back")}
                className="text-muted-foreground hover:text-foreground transition shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 flex-1">
                {activeOrder.map((s, i) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i <= stepIndex ? "bg-brand" : "bg-secondary"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {step === "phrase" && (
            <PhraseStep
              revealed={revealed}
              setRevealed={setRevealed}
              copied={copied}
              onCopy={copyPhrase}
              onContinue={() => setStep("password")}
            />
          )}

          {step === "import" && (
            <ImportStep
              value={seedInput}
              onChange={setSeedInput}
              onContinue={() => setStep("password")}
            />
          )}

          {step === "password" && (
            <PasswordStep
              value={password}
              onChange={setPassword}
              show={showPwd}
              setShow={setShowPwd}
              error={pwdError}
              onContinue={submitPassword}
            />
          )}

          {step === "confirm" && (
            <ConfirmStep
              value={confirm}
              onChange={setConfirm}
              show={showConfirm}
              setShow={setShowConfirm}
              error={pwdError}
              onContinue={submitConfirm}
              ctaLabel={flow === "import" ? t("onboarding.importSeedPhrase") : t("onboarding.createWallet")}
            />
          )}

          {step === "created" && (
            <CreatedStep
              address={address}
              flow={flow}
              onContinue={() => setStep("model")}
            />
          )}

          {step === "model" && (
            <ModelStep
              selected={selectedModel}
              downloading={downloading}
              downloaded={downloaded}
              onDownload={startDownload}
              onSelect={setSelectedModel}
              onContinue={finish}
              onBack={() => setStep("created")}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function ChooseStep({ onCreate, onImport }: { onCreate: () => void; onImport: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Asterisk className="w-6 h-6 text-brand mb-4" />
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {t("onboarding.setupWalletTitle")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        {t("onboarding.setupWalletSubtitle")}
      </p>

      <div className="mt-7 space-y-4">
        {[
          {
            title: t("onboarding.createWallet"),
            description: t("onboarding.createWalletDescription"),
            icon: <PlusCircle className="w-6 h-6 text-brand" />,
            onClick: onCreate,
          },
          {
            title: t("onboarding.importSeedPhrase"),
            description: t("onboarding.importSeedPhraseDescription"),
            icon: <Download className="w-6 h-6 text-brand" />,
            onClick: onImport,
          },
        ].map((opt) => (
          <button
            key={opt.title}
            type="button"
            onClick={opt.onClick}
            className="group w-full flex items-center gap-4 rounded-2xl border border-border bg-background dark:bg-background/50 px-5 py-4 text-left hover:border-brand hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-brand/40 transition"
          >
            <span className="shrink-0">{opt.icon}</span>
            <span className="flex-1">
              <span className="block text-base font-semibold text-foreground">{opt.title}</span>
              <span className="block text-sm text-muted-foreground">{opt.description}</span>
            </span>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-brand group-hover:translate-x-0.5 transition" />
          </button>
        ))}
      </div>
    </>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand text-brand-foreground font-semibold px-6 py-3.5 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-[0_10px_30px_-10px_var(--brand)]"
    >
      {children}
    </button>
  );
}

function PhraseStep({
  revealed,
  setRevealed,
  copied,
  onCopy,
  onContinue,
}: {
  revealed: boolean;
  setRevealed: (v: boolean) => void;
  copied: boolean;
  onCopy: () => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {t("onboarding.yourRecoveryPhrase")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        {t("onboarding.writeItDown")}
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-background dark:bg-background/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setRevealed(!revealed)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {revealed ? t("onboarding.hide") : t("onboarding.reveal")}
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-2 text-sm text-brand hover:opacity-80 transition"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? t("common.copied") : t("common.copy")}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SAMPLE_PHRASE.map((word, i) => (
            <div
              key={i}
              className="rounded-lg bg-secondary/60 px-3 py-2 text-sm text-foreground/90"
            >
              <span className="text-muted-foreground mr-1">{i + 1}.</span>
              {revealed ? word : "••••"}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
        <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
        <p>{t("onboarding.writeItDown")}</p>
      </div>

      <PrimaryButton onClick={onContinue}>
        {t("onboarding.iSavedIt")} <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </>
  );
}

function PasswordField({
  value,
  onChange,
  show,
  setShow,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (v: boolean) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative mt-6">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-full border border-border bg-background dark:bg-background/50 px-5 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function PasswordStep({
  value,
  onChange,
  show,
  setShow,
  error,
  onContinue,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (v: boolean) => void;
  error: string | null;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {t("onboarding.createPassword")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        {t("onboarding.passwordHint")}
      </p>
      <PasswordField
        value={value}
        onChange={onChange}
        show={show}
        setShow={setShow}
        placeholder="••••••••"
        autoFocus
      />
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <PrimaryButton onClick={onContinue} disabled={value.length === 0}>
        {t("common.continue")} <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </>
  );
}

function ConfirmStep({
  value,
  onChange,
  show,
  setShow,
  error,
  onContinue,
  ctaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (v: boolean) => void;
  error: string | null;
  onContinue: () => void;
  ctaLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {t("onboarding.confirmPassword")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        {t("onboarding.confirmPassword")}
      </p>
      <PasswordField
        value={value}
        onChange={onChange}
        show={show}
        setShow={setShow}
        placeholder="••••••••"
        autoFocus
      />
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <PrimaryButton onClick={onContinue} disabled={value.length === 0}>
        {ctaLabel ?? t("onboarding.createWallet")}
      </PrimaryButton>
    </>
  );
}

function ImportStep({
  value,
  onChange,
  onContinue,
}: {
  value: string;
  onChange: (v: string) => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  const normalized = value.trim().replace(/\s+/g, " ");
  const wordCount = normalized ? normalized.split(" ").length : 0;
  const valid = [12, 15, 18, 21, 24].includes(wordCount);
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {t("onboarding.enterSeedPhrase")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        {t("onboarding.pasteOrType")}
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("onboarding.enterSeedPhrase")}
        rows={5}
        autoFocus
        className="mt-6 w-full rounded-2xl border border-border bg-background dark:bg-background/50 px-5 py-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition resize-none"
      />
      <PrimaryButton onClick={onContinue} disabled={!valid}>
        {t("common.continue")} <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </>
  );
}

function CreatedStep({ address, flow, onContinue }: { address: string; flow: Flow; onContinue: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center">
        <Check className="w-10 h-10 text-emerald-400" strokeWidth={3} />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
        {t("onboarding.walletCreated")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("onboarding.walletCreatedDesc")}
      </p>

      <div className="mt-6 w-full rounded-2xl border border-border bg-background dark:bg-background/50 px-5 py-4 text-center">
        <p className="text-xs text-muted-foreground">{t("onboarding.yourAddress")}</p>
        <p className="mt-1 font-mono text-sm text-foreground break-all">{address}</p>
      </div>

      <div className="w-full">
        <PrimaryButton onClick={onContinue}>{t("common.continue")}</PrimaryButton>
      </div>
    </div>
  );
}

function ModelStep({
  selected,
  downloading,
  downloaded,
  onDownload,
  onSelect,
  onContinue,
  onBack,
}: {
  selected: string | null;
  downloading: string | null;
  downloaded: Record<string, boolean>;
  onDownload: (id: string) => void;
  onSelect: (id: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const ready = selected && downloaded[selected];
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        aria-label={t("common.back")}
        className="text-muted-foreground hover:text-foreground transition shrink-0 mb-6 self-start"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {t("onboarding.chooseModel")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        {t("onboarding.chooseModelDesc")}
      </p>

      <div className="mt-6 space-y-5">
        {MODELS.map((m) => {
          const isDl = downloading === m.id;
          const isReady = downloaded[m.id];
          const isSelected = selected === m.id;
          return (
            <div key={m.id}>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {m.tier}
              </p>
              <button
                type="button"
                onClick={() => (isReady ? onSelect(m.id) : onDownload(m.id))}
                disabled={isDl}
                className={`w-full flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition focus:outline-none focus:ring-2 focus:ring-brand/40 ${
                  isSelected
                    ? "border-brand bg-secondary/60"
                    : "border-border bg-background dark:bg-background/50 hover:border-brand/60"
                }`}
              >
                <span className="flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="text-base font-semibold text-foreground">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.size}</span>
                  </span>
                  <span className="block text-sm text-muted-foreground mt-0.5">
                    {m.description}
                  </span>
                </span>
                <span className="shrink-0 w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-foreground">
                  {isDl ? (
                    <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  ) : isReady ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <PrimaryButton onClick={onContinue} disabled={!ready}>
        {t("onboarding.continueToHome")} <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </>
  );
}
