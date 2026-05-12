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
import { desktopViewSeedPhrase, isDestrallDesktop } from "@/lib/desktopWallet";

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
  const [words, setWords] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("password");
        setPassword("");
        setError(null);
        setRevealed(false);
        setCopied(false);
        setWords([]);
        setIsSubmitting(false);
      }, 150);
    }
  }, [open]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim().length < 8) {
      setError(t("onboarding.passwordTooShort"));
      return;
    }
    if (!isDestrallDesktop()) {
      setError("Recovery phrase is only available in the Destrall desktop app.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const mnemonic = await desktopViewSeedPhrase(password);
      setWords(mnemonic.split(/\s+/).filter(Boolean));
      setStep("phrase");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reveal recovery phrase");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!words.length) return;
    try {
      await navigator.clipboard.writeText(words.join(" "));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.recoveryPhrase")}</DialogTitle>
          <DialogDescription>
            {step === "password"
              ? t(
                  "settings.recoveryPhrasePasswordHint",
                  "Enter your wallet password to view your recovery phrase.",
                )
              : t(
                  "settings.recoveryPhraseRevealHint",
                  "Write these words down and store them offline.",
                )}
          </DialogDescription>
        </DialogHeader>

        {step === "password" ? (
          <form onSubmit={handleConfirm} className="space-y-4">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Verifying…" : t("common.continue")}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setRevealed((value) => !value)}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
              >
                {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {revealed ? t("onboarding.hide") : t("onboarding.reveal")}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  "inline-flex items-center gap-2 text-sm transition",
                  copied ? "text-emerald-400" : "text-brand hover:opacity-80",
                )}
              >
                <Copy className="w-4 h-4" />
                {copied ? t("common.copied") : t("common.copy")}
              </button>
            </div>
            <PhraseGrid revealed={revealed} words={words} />
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{t("onboarding.writeItDown")}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PhraseGrid({
  revealed,
  words,
}: {
  revealed: boolean;
  words: string[];
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {words.map((word, index) => (
        <div
          key={`${index}-${word}`}
          className="rounded-lg bg-secondary/60 px-3 py-2 text-sm text-foreground/90"
        >
          <span className="text-muted-foreground mr-1">{index + 1}.</span>
          {revealed ? word : "••••"}
        </div>
      ))}
    </div>
  );
}
