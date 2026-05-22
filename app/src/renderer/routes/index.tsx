import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Languages,
  Moon,
  PlusCircle,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { SelectModal } from "@/components/settings/SelectModal";
import { Progress } from "@/components/ui/progress";
import { useTheme } from "@/hooks/use-theme";
import { useOnboardingStore } from "@/stores/onboardingStore";
import {
  useSettingsStore,
  SUPPORTED_LANGUAGES,
  type AppLanguage,
} from "@/stores/settingsStore";
import { useAiModelStore } from "@/stores/aiModelStore";
import { useWalletStore } from "@/stores/walletStore";
import { normalizeMnemonicInput } from "../../shared/mnemonicNormalize";
import { desktopPreviewMnemonic, isDestrallDesktop } from "@/lib/desktopWallet";
import { AppLogo } from "@/components/branding/AppLogo";
import { BRANDING } from "@config/branding";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: `Set Up Your Wallet — ${BRANDING.appName}` },
      { name: "description", content: "Create a multi-chain wallet and set up the on-device assistant." },
    ],
  }),
});

type Step =
  | "choose"
  | "phrase"
  | "confirm-phrase"
  | "import"
  | "password"
  | "confirm"
  | "created"
  | "model";

type Flow = "create" | "import";

const STEP_ORDER: Step[] = ["phrase", "confirm-phrase", "password", "confirm", "created"];
const IMPORT_STEP_ORDER: Step[] = ["import", "password", "confirm", "created"];

function Index() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { theme, toggle: toggleTheme } = useTheme();
  const setOnboardingComplete = useOnboardingStore((s) => s.setOnboardingComplete);
  const setWalletSetupComplete = useOnboardingStore((s) => s.setWalletSetupComplete);
  const setAiSetupComplete = useOnboardingStore((s) => s.setAiModelSetupComplete);
  const downloadModel = useAiModelStore((s) => s.downloadModel);
  const refreshAiModels = useAiModelStore((s) => s.refreshFromMain);
  const isDownloaded = useAiModelStore((s) => s.isDownloaded);
  const isDownloading = useAiModelStore((s) => s.isDownloading);
  const downloadProgress = useAiModelStore((s) => s.downloadProgress);
  const modelSetupError = useAiModelStore((s) => s.error);
  const createWallet = useWalletStore((s) => s.createWallet);
  const importWallet = useWalletStore((s) => s.importWallet);

  const [step, setStep] = useState<Step>("choose");
  const [flow, setFlow] = useState<Flow>("create");
  const [seedInput, setSeedInput] = useState("");
  const [creationMnemonic, setCreationMnemonic] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdAddress, setCreatedAddress] = useState<string | null>(null);
  const [confirmWordA, setConfirmWordA] = useState("");
  const [confirmWordB, setConfirmWordB] = useState("");
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  const creationWords = useMemo(
    () => creationMnemonic?.split(/\s+/).filter(Boolean) ?? [],
    [creationMnemonic],
  );
  const normalizedImportSeed = useMemo(() => normalizeMnemonicInput(seedInput), [seedInput]);
  const isValidImportMnemonic = useMemo(
    () => normalizedImportSeed.length > 0 && validateMnemonic(normalizedImportSeed, wordlist),
    [normalizedImportSeed],
  );

  const confirmIndexes = useMemo(() => {
    if (creationWords.length < 12) return [2, 8] as const;
    const first = 2;
    const second = Math.min(creationWords.length - 1, 8);
    return [first, second] as const;
  }, [creationWords.length]);

  useEffect(() => {
    if (step !== "model" || !isDestrallDesktop()) return;
    void refreshAiModels();
  }, [step, refreshAiModels]);

  useEffect(() => {
    if (flow !== "create" || creationMnemonic != null || previewError) return;
    void (async () => {
      try {
        if (!isDestrallDesktop()) {
          setPreviewError("Open wallet setup inside the Destrall desktop app.");
          return;
        }
        const mnemonic = await desktopPreviewMnemonic();
        setCreationMnemonic(mnemonic);
      } catch (error) {
        setPreviewError(error instanceof Error ? error.message : "Could not start wallet setup");
      }
    })();
  }, [creationMnemonic, flow, previewError]);

  const activeOrder = flow === "import" ? IMPORT_STEP_ORDER : STEP_ORDER;
  const stepIndex = activeOrder.indexOf(step as (typeof activeOrder)[number]);

  const goBack = () => {
    setSubmitError(null);
    if (step === "phrase" || step === "import") setStep("choose");
    else if (step === "confirm-phrase") setStep("phrase");
    else if (step === "password") setStep(flow === "import" ? "import" : "confirm-phrase");
    else if (step === "confirm") setStep("password");
    else if (step === "created") setStep("confirm");
    else if (step === "model") setStep("created");
  };

  const copyPhrase = async () => {
    const text = flow === "import" ? normalizedImportSeed : creationMnemonic ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
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

  const commitWallet = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      if (!isDestrallDesktop()) {
        throw new Error("Wallet setup requires the Destrall desktop app.");
      }
      if (flow === "import") {
        if (!isValidImportMnemonic) {
          throw new Error("Enter a valid BIP-39 recovery phrase.");
        }
        const account = await importWallet({
          mnemonic: normalizedImportSeed,
          password,
        });
        setCreatedAddress(account.address);
      } else {
        if (!creationMnemonic) throw new Error("Recovery phrase not ready");
        const account = await createWallet({
          mnemonic: creationMnemonic,
          password,
        });
        setCreatedAddress(account.address);
      }
      setCreationMnemonic(null);
      setSeedInput("");
      setPassword("");
      setConfirm("");
      setWalletSetupComplete(true);
      setStep("created");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Wallet setup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitConfirm = () => {
    if (confirm !== password) {
      setPwdError(t("onboarding.passwordsDoNotMatch"));
      return;
    }
    setPwdError(null);
    void commitWallet();
  };

  const startDownload = async () => {
    if (!isDestrallDesktop()) return;
    try {
      await downloadModel();
    } catch {
      /* error visible via modelSetupError */
    }
  };

  const finish = () => {
    setAiSetupComplete(true);
    setOnboardingComplete(true);
    navigate({ to: "/home" });
  };

  const skipModelSetup = () => {
    void refreshAiModels();
    finish();
  };

  const phraseConfirmed =
    confirmWordA.trim().toLowerCase() === creationWords[confirmIndexes[0]]?.toLowerCase() &&
    confirmWordB.trim().toLowerCase() === creationWords[confirmIndexes[1]]?.toLowerCase();

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-background px-4 py-10 relative">
      <div className="absolute top-5 right-5 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setLanguageModalOpen(true)}
          aria-label={t("settings.language")}
          className="inline-flex items-center justify-center rounded-full border border-border bg-card/70 backdrop-blur w-10 h-10 text-foreground hover:bg-card transition shadow-sm"
        >
          <Languages className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={t("settings.theme")}
          className="inline-flex items-center justify-center rounded-full border border-border bg-card/70 backdrop-blur w-10 h-10 text-foreground hover:bg-card transition shadow-sm"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
      <SelectModal<AppLanguage>
        open={languageModalOpen}
        onOpenChange={setLanguageModalOpen}
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
      <div
        className="w-full max-w-5xl rounded-3xl bg-card overflow-hidden grid md:grid-cols-2"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <LeftPanel />
        <RightPanel
          step={step}
          flow={flow}
          activeOrder={activeOrder}
          stepIndex={stepIndex}
          goBack={goBack}
          setFlow={setFlow}
          setStep={setStep}
          revealed={revealed}
          setRevealed={setRevealed}
          copied={copied}
          copyPhrase={copyPhrase}
          creationWords={creationWords}
          previewError={previewError}
          confirmIndexes={confirmIndexes}
          confirmWordA={confirmWordA}
          setConfirmWordA={setConfirmWordA}
          confirmWordB={confirmWordB}
          setConfirmWordB={setConfirmWordB}
          phraseConfirmed={phraseConfirmed}
          seedInput={seedInput}
          setSeedInput={setSeedInput}
          isValidImportMnemonic={isValidImportMnemonic}
          password={password}
          setPassword={setPassword}
          showPwd={showPwd}
          setShowPwd={setShowPwd}
          pwdError={pwdError}
          submitPassword={submitPassword}
          confirm={confirm}
          setConfirm={setConfirm}
          showConfirm={showConfirm}
          setShowConfirm={setShowConfirm}
          submitConfirm={submitConfirm}
          submitError={submitError}
          isSubmitting={isSubmitting}
          createdAddress={createdAddress}
          isDownloaded={isDownloaded}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
          modelSetupError={modelSetupError}
          startDownload={startDownload}
          finish={finish}
          skipModelSetup={skipModelSetup}
          t={t}
        />
      </div>
    </main>
  );
}

function LeftPanel() {
  return (
    <div
      className="relative hidden md:flex flex-col justify-between p-8 m-3 rounded-2xl text-white min-h-[560px]"
      style={{ background: "var(--gradient-brand)" }}
    >
      <AppLogo variant="mark" size="lg" imageClassName="brightness-0 invert" />
      <div className="space-y-2">
        <p className="text-sm/relaxed opacity-90">You can easily</p>
        <h2 className="text-2xl font-semibold leading-snug max-w-[18rem]">
          Get access your personal hub for clarity and productivity
        </h2>
      </div>
      <div className="absolute inset-0 rounded-2xl ring-1 ring-white/20 pointer-events-none" />
    </div>
  );
}

type RightPanelProps = {
  step: Step;
  flow: Flow;
  activeOrder: Step[];
  stepIndex: number;
  goBack: () => void;
  setFlow: (flow: Flow) => void;
  setStep: (step: Step) => void;
  revealed: boolean;
  setRevealed: (value: boolean) => void;
  copied: boolean;
  copyPhrase: () => void;
  creationWords: string[];
  previewError: string | null;
  confirmIndexes: readonly [number, number];
  confirmWordA: string;
  setConfirmWordA: (value: string) => void;
  confirmWordB: string;
  setConfirmWordB: (value: string) => void;
  phraseConfirmed: boolean;
  seedInput: string;
  setSeedInput: (value: string) => void;
  isValidImportMnemonic: boolean;
  password: string;
  setPassword: (value: string) => void;
  showPwd: boolean;
  setShowPwd: (value: boolean) => void;
  pwdError: string | null;
  submitPassword: () => void;
  confirm: string;
  setConfirm: (value: string) => void;
  showConfirm: boolean;
  setShowConfirm: (value: boolean) => void;
  submitConfirm: () => void;
  submitError: string | null;
  isSubmitting: boolean;
  createdAddress: string | null;
  isDownloaded: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  modelSetupError: string | null;
  startDownload: () => void | Promise<void>;
  finish: () => void;
  skipModelSetup: () => void;
  t: ReturnType<typeof useTranslation>["t"];
};

function RightPanel(props: RightPanelProps) {
  const {
    step,
    flow,
    activeOrder,
    stepIndex,
    goBack,
    setFlow,
    setStep,
    revealed,
    setRevealed,
    copied,
    copyPhrase,
    creationWords,
    previewError,
    confirmIndexes,
    confirmWordA,
    setConfirmWordA,
    confirmWordB,
    setConfirmWordB,
    phraseConfirmed,
    seedInput,
    setSeedInput,
    isValidImportMnemonic,
    password,
    setPassword,
    showPwd,
    setShowPwd,
    pwdError,
    submitPassword,
    confirm,
    setConfirm,
    showConfirm,
    setShowConfirm,
    submitConfirm,
    submitError,
    isSubmitting,
    createdAddress,
    isDownloaded,
    isDownloading,
    downloadProgress,
    modelSetupError,
    startDownload,
    finish,
    skipModelSetup,
    t,
  } = props;

  return (
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
          <StepBar activeOrder={activeOrder} stepIndex={stepIndex} />
        </div>
      )}

      {step === "phrase" && (
        <PhraseStep
          revealed={revealed}
          setRevealed={setRevealed}
          copied={copied}
          onCopy={copyPhrase}
          words={creationWords}
          previewError={previewError}
          onContinue={() => setStep("confirm-phrase")}
        />
      )}

      {step === "confirm-phrase" && (
        <ConfirmPhraseStep
          indexes={confirmIndexes}
          confirmWordA={confirmWordA}
          setConfirmWordA={setConfirmWordA}
          confirmWordB={confirmWordB}
          setConfirmWordB={setConfirmWordB}
          onContinue={() => setStep("password")}
          canContinue={phraseConfirmed}
        />
      )}

      {step === "import" && (
        <ImportStep
          value={seedInput}
          onChange={setSeedInput}
          onContinue={() => setStep("password")}
          isValid={isValidImportMnemonic}
          showValidationError={seedInput.trim().length > 0 && !isValidImportMnemonic}
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
          error={pwdError ?? submitError}
          onContinue={submitConfirm}
          ctaLabel={flow === "import" ? t("onboarding.importSeedPhrase") : t("onboarding.createWallet")}
          disabled={isSubmitting}
        />
      )}

      {step === "created" && (
        <CreatedStep
          flow={flow}
          address={createdAddress ?? ""}
          onContinue={() => setStep("model")}
        />
      )}

      {step === "model" && (
        <ModelStep
          isDownloaded={isDownloaded}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
          modelSetupError={modelSetupError}
          onDownload={startDownload}
          onContinue={finish}
          onSkip={skipModelSetup}
          onBack={() => setStep("created")}
        />
      )}
    </div>
  );
}

function StepBar({ activeOrder, stepIndex }: { activeOrder: Step[]; stepIndex: number }) {
  return (
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
  );
}

function ChooseStep({ onCreate, onImport }: { onCreate: () => void; onImport: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <AppLogo variant="mark" size="md" className="mb-4" />
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
  words,
  previewError,
}: {
  revealed: boolean;
  setRevealed: (v: boolean) => void;
  copied: boolean;
  onCopy: () => void;
  onContinue: () => void;
  words: string[];
  previewError: string | null;
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

      {previewError && <p className="mt-4 text-sm text-destructive">{previewError}</p>}

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
        <PhraseGrid revealed={revealed} words={words} />
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
        <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
        <p>{t("onboarding.writeItDown")}</p>
      </div>

      <PrimaryButton onClick={onContinue} disabled={words.length < 12 || !!previewError}>
        {t("onboarding.iSavedIt")} <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </>
  );
}

function PhraseGrid({ revealed, words }: { revealed: boolean; words: string[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {words.map((word, i) => (
        <PhraseCell key={i} index={i} revealed={revealed} word={word} />
      ))}
    </div>
  );
}

function PhraseCell({
  index,
  revealed,
  word,
}: {
  index: number;
  revealed: boolean;
  word: string;
}) {
  return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2 text-sm text-foreground/90">
      <span className="text-muted-foreground mr-1">{index + 1}.</span>
      {revealed ? word : "••••"}
    </div>
  );
}

function ConfirmPhraseStep({
  indexes,
  confirmWordA,
  setConfirmWordA,
  confirmWordB,
  setConfirmWordB,
  onContinue,
  canContinue,
}: {
  indexes: readonly [number, number];
  confirmWordA: string;
  setConfirmWordA: (value: string) => void;
  confirmWordB: string;
  setConfirmWordB: (value: string) => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Confirm recovery phrase</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        Enter words {indexes[0] + 1} and {indexes[1] + 1} from your recovery phrase.
      </p>
      <input
        value={confirmWordA}
        onChange={(e) => setConfirmWordA(e.target.value)}
        placeholder={`Word ${indexes[0] + 1}`}
        className="mt-6 w-full rounded-full border border-border bg-background px-5 py-3.5"
      />
      <input
        value={confirmWordB}
        onChange={(e) => setConfirmWordB(e.target.value)}
        placeholder={`Word ${indexes[1] + 1}`}
        className="mt-3 w-full rounded-full border border-border bg-background px-5 py-3.5"
      />
      <PrimaryButton onClick={onContinue} disabled={!canContinue}>
        Continue <ArrowRight className="w-4 h-4" />
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
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (v: boolean) => void;
  error: string | null;
  onContinue: () => void;
  ctaLabel?: string;
  disabled?: boolean;
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
      <PrimaryButton onClick={onContinue} disabled={value.length === 0 || disabled}>
        {ctaLabel ?? t("onboarding.createWallet")}
      </PrimaryButton>
    </>
  );
}

function ImportStep({
  value,
  onChange,
  onContinue,
  isValid,
  showValidationError,
}: {
  value: string;
  onChange: (v: string) => void;
  onContinue: () => void;
  isValid: boolean;
  showValidationError: boolean;
}) {
  const { t } = useTranslation();
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
      <p className="mt-2 text-xs text-muted-foreground">
        Extra spaces and line breaks are collapsed before validation.
      </p>
      {showValidationError ? (
        <p className="mt-2 text-sm text-destructive">Enter a valid BIP-39 recovery phrase.</p>
      ) : null}
      <PrimaryButton onClick={onContinue} disabled={!isValid}>
        {t("common.continue")} <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </>
  );
}

function CreatedStep({
  flow,
  address,
  onContinue,
}: {
  flow: Flow;
  address: string;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  const title =
    flow === "import" ? t("onboarding.walletImported") : t("onboarding.walletCreated");
  const subtitle =
    flow === "import" ? t("onboarding.walletImportedDesc") : t("onboarding.walletCreatedDesc");
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center">
        <Check className="w-10 h-10 text-emerald-400" strokeWidth={3} />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

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
  isDownloaded,
  isDownloading,
  downloadProgress,
  modelSetupError,
  onDownload,
  onContinue,
  onSkip,
  onBack,
}: {
  isDownloaded: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  modelSetupError: string | null;
  onDownload: () => void | Promise<void>;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const isLoaded = useAiModelStore((s) => s.isLoaded);
  const isLoading = useAiModelStore((s) => s.isLoading);
  const loadModel = useAiModelStore((s) => s.loadModel);

  useEffect(() => {
    if (!isDestrallDesktop()) return;
    if (isDownloaded && !isLoaded && !isDownloading && !isLoading) {
      void loadModel().catch(() => {
        /* surfaced via modelSetupError */
      });
    }
  }, [isDownloaded, isLoaded, isDownloading, isLoading, loadModel]);

  const ready = isDownloaded && isLoaded;

  let phaseLabel = "";
  if (isDownloading) {
    phaseLabel = t("onboarding.aiPhaseDownloading", "Downloading…");
  } else if (isLoading) {
    phaseLabel = t("onboarding.aiPhasePreparing", "Preparing…");
  } else if (ready) {
    phaseLabel = t("onboarding.aiPhaseReady", "Ready");
  }

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
        {t("onboarding.downloadAiTitle", "Download AI")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        {t("onboarding.downloadAiDesc", "Download the AI required to use the assistant.")}
      </p>

      {modelSetupError ? (
        <p className="mt-4 text-sm text-destructive max-w-md" role="alert">
          {modelSetupError}
        </p>
      ) : null}

      {isDownloading || isLoading ? (
        <div className="mt-4 w-full max-w-md space-y-2">
          <p className="text-xs text-muted-foreground">
            {phaseLabel} {isDownloading ? `${downloadProgress}%` : ""}
          </p>
          <Progress value={isDownloading ? downloadProgress : isLoading ? 70 : 0} className="h-2" />
        </div>
      ) : null}

      <div className="mt-8 w-full max-w-md space-y-3">
        {!isDownloaded ? (
          <PrimaryButton
            onClick={() => {
              void onDownload();
            }}
            disabled={isDownloading}
          >
            <Download className="w-4 h-4" />
            {t("onboarding.downloadAiButton", "Download")}
          </PrimaryButton>
        ) : null}

        <PrimaryButton onClick={onContinue} disabled={!ready}>
          {t("onboarding.continueToHome")} <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
        <button
          type="button"
          onClick={onSkip}
          className="w-full text-sm font-medium text-muted-foreground hover:text-foreground transition py-2"
        >
          {t("onboarding.skipForNow")}
        </button>
      </div>
    </>
  );
}
