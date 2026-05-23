import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TERMS_AND_CONDITIONS_URL } from "../../../shared/wallet/terms";
import { desktopOpenExternalUrl, isDestrallDesktop } from "@/lib/desktopWallet";
import { cn } from "@/lib/utils";

type TermsAcceptanceFieldProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  showValidationError?: boolean;
  className?: string;
};

export function TermsAcceptanceField({
  checked,
  onCheckedChange,
  showValidationError = false,
  className,
}: TermsAcceptanceFieldProps) {
  const { t } = useTranslation();

  const openTerms = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDestrallDesktop()) return;
    void desktopOpenExternalUrl(TERMS_AND_CONDITIONS_URL);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start gap-3 rounded-xl border border-border bg-background/50 dark:bg-background/30 px-4 py-3">
        <Checkbox
          id="terms-acceptance"
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          className="mt-0.5"
        />
        <Label htmlFor="terms-acceptance" className="text-sm leading-relaxed text-foreground font-normal">
          {t("onboarding.termsPrefix", "I have read and agree to the")}{" "}
          <button
            type="button"
            onClick={openTerms}
            className="text-brand font-medium underline underline-offset-2 hover:opacity-90"
          >
            {t("onboarding.termsLink", "Terms and Conditions")}
          </button>
          .
        </Label>
      </div>
      {showValidationError ? (
        <p className="text-sm text-destructive" role="alert">
          {t(
            "onboarding.termsRequired",
            "You must accept the Terms and Conditions before continuing.",
          )}
        </p>
      ) : null}
    </div>
  );
}
