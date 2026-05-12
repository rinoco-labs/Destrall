import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Eye, EyeOff, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Demo seed phrase. In a real wallet, this would be decrypted from secure
// storage using the wallet password — never persisted in plaintext.
const DEMO_SEED = [
  "month",
  "shrimp",
  "budget",
  "whisper",
  "behind",
  "earth",
  "gadget",
  "year",
  "april",
  "toddler",
  "hair",
  "fluid",
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RecoveryPhraseModal({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"password" | "phrase">("password");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      // reset on close
      setTimeout(() => {
        setStep("password");
        setPassword("");
        setError(null);
        setRevealed(false);
        setCopied(false);
      }, 150);
    }
  }, [open]);

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim().length < 8) {
      setError(t("onboarding.passwordTooShort"));
      return;
    }
    // Demo: accept any 8+ char password. Real impl would verify against KDF.
    setError(null);
    setStep("phrase");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(DEMO_SEED.join(" "));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card/95 backdrop-blur border-border max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.recoveryPhrase")}</DialogTitle>
          <DialogDescription>
            {step === "password"
              ? "Enter the wallet password you set when you created or imported this wallet. This is separate from the app lock password."
              : "Write these words down and keep them safe. Never share them."}
          </DialogDescription>
        </DialogHeader>

        {step === "password" ? (
          <form onSubmit={handleConfirm} className="mt-2 space-y-4">
            <Input
              type="password"
              autoFocus
              placeholder="Wallet password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 bg-background/60"
            />
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full h-12 bg-brand/20 hover:bg-brand/30 text-foreground border border-brand/40"
            >
              {t("common.continue", "Confirm")}
            </Button>
          </form>
        ) : (
          <div className="mt-2 space-y-4">
            <div className="relative rounded-2xl border border-border bg-background/40 p-4">
              <div
                className={cn(
                  "grid grid-cols-3 gap-2 transition",
                  !revealed && "blur-md select-none pointer-events-none",
                )}
              >
                {DEMO_SEED.map((word, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg bg-secondary/50 border border-border px-3 py-2"
                  >
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {i + 1}.
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {word}
                    </span>
                  </div>
                ))}
              </div>
              {!revealed && (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition"
                >
                  <EyeOff className="w-6 h-6" />
                  <span className="text-sm">{t("onboarding.reveal", "Tap to reveal")}</span>
                </button>
              )}
            </div>

            {revealed && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setRevealed(false)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {t("onboarding.hide", "Hide")}
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-brand/20 hover:bg-brand/30 text-foreground border border-brand/40"
                  onClick={handleCopy}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {copied ? t("common.copied") : t("common.copy")}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
