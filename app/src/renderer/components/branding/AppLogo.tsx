import { BRANDING, type BrandingAssetKey } from "../../../config/branding";
import { cn } from "@/lib/utils";

type AppLogoVariant = "full" | "mark" | "icon";

const VARIANT_ASSET: Record<AppLogoVariant, BrandingAssetKey> = {
  full: "logo",
  mark: "logoMark",
  icon: "icon",
};

type AppLogoProps = {
  variant?: AppLogoVariant;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  imageClassName?: string;
  showName?: boolean;
  nameClassName?: string;
};

const SIZE_PX: Record<NonNullable<AppLogoProps["size"]>, number> = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
};

export function AppLogo({
  variant = "full",
  size = "md",
  className,
  imageClassName,
  showName = false,
  nameClassName,
}: AppLogoProps) {
  const px = SIZE_PX[size];
  const src = BRANDING.assets[VARIANT_ASSET[variant]];

  return (
    <div className={cn("inline-flex items-center gap-2 min-w-0", className)}>
      <img
        src={src}
        alt=""
        width={px}
        height={px}
        draggable={false}
        className={cn("shrink-0 object-contain", imageClassName)}
        style={{ width: px, height: px }}
      />
      {showName ? (
        <span className={cn("font-bold tracking-tight truncate", nameClassName)}>{BRANDING.appName}</span>
      ) : null}
    </div>
  );
}

export function AppLogoSplash({ className }: { className?: string }) {
  return (
    <img
      src={BRANDING.assets.logo}
      alt={BRANDING.appName}
      draggable={false}
      className={cn("object-contain", className)}
    />
  );
}
