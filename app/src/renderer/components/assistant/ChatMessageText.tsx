import { Fragment } from "react";
import {
  splitTextByWalletAddresses,
  textContainsWalletAddress,
  type FormatWalletAddressOptions,
} from "../../../shared/formatWalletAddress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const CHAT_TEXT_CLASS = "min-w-0 max-w-full wrap-anywhere wrap-break-word";

function WalletAddressSpan({ address, display }: { address: string; display: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="font-mono" title={address}>
          {display}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-mono text-xs break-all">{address}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function renderWalletAwareSegments(
  text: string,
  keyPrefix: string,
  options?: FormatWalletAddressOptions,
) {
  return splitTextByWalletAddresses(text, options).map((seg, i) => {
    const key = `${keyPrefix}-${i}`;
    if (seg.type === "text") {
      return <Fragment key={key}>{seg.value}</Fragment>;
    }
    return <WalletAddressSpan key={key} address={seg.value} display={seg.display} />;
  });
}

export function ChatMessageText({
  text,
  className,
  as: Tag = "span",
  formatOptions,
}: {
  text: string;
  className?: string;
  as?: "span" | "div";
  formatOptions?: FormatWalletAddressOptions;
}) {
  if (!text) return null;

  const hasAddress = splitTextByWalletAddresses(text, formatOptions).some(
    (s) => s.type === "address",
  );

  const body = renderWalletAwareSegments(text, "seg", formatOptions);

  if (!hasAddress) {
    return <Tag className={cn(CHAT_TEXT_CLASS, className)}>{body}</Tag>;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tag className={cn(CHAT_TEXT_CLASS, className)}>{body}</Tag>
    </TooltipProvider>
  );
}

/** Renders assistant-style `**bold**` segments with wallet-aware address shortening. */
export function ChatMessageTextWithBold({
  text,
  className,
  as: Tag = "div",
}: {
  text: string;
  className?: string;
  as?: "span" | "div";
}) {
  if (!text) return null;

  const inner = (
    <Tag className={cn(CHAT_TEXT_CLASS, className)}>
      {text.split("**").map((chunk, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold">
            {renderWalletAwareSegments(chunk, `b-${i}`)}
          </strong>
        ) : (
          <Fragment key={i}>{renderWalletAwareSegments(chunk, `t-${i}`)}</Fragment>
        ),
      )}
    </Tag>
  );

  if (!textContainsWalletAddress(text)) return inner;

  return <TooltipProvider delayDuration={300}>{inner}</TooltipProvider>;
}
