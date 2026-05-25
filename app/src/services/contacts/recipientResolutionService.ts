import { isValidSuiNSName } from "@mysten/sui/utils";
import type { SuiChainEnvironment } from "../../config/chains/sui";
import { resolveSuiNSName } from "../suins/suinsResolutionService";
import { resolveAddressForSend } from "./resolveAddressForSend";
import {
  resolveRecipientLabel,
  type ContactLike,
  type WalletAccountLike,
} from "./contactResolutionService";

export type SendRecipientResolution =
  | { kind: "sui_address"; address: string }
  | { kind: "single_contact"; contact: ContactLike; address: string }
  | { kind: "suins_name"; displayName: string; address: string }
  | { kind: "ambiguous_contact"; matches: ContactLike[]; query: string }
  | { kind: "ambiguous_account"; matches: WalletAccountLike[]; query: string }
  | { kind: "invalid_contact_address"; contact: ContactLike; query: string }
  | { kind: "none"; query: string };

/**
 * Resolve a send recipient for the assistant: wallet address → contacts → SuiNS.
 * Does not build or sign transactions; returns `none` when nothing matches.
 */
export async function resolveSendRecipient(params: {
  recipient: string;
  contacts: ContactLike[];
  otherAccounts?: WalletAccountLike[];
  suiEnvironment: SuiChainEnvironment;
}): Promise<SendRecipientResolution> {
  const label = resolveRecipientLabel({
    recipient: params.recipient,
    contacts: params.contacts,
    otherAccounts: params.otherAccounts,
  });

  if (label.kind === "sui_address") {
    return { kind: "sui_address", address: label.address };
  }

  if (label.kind === "single_contact") {
    const address = await resolveAddressForSend(label.contact.address, params.suiEnvironment);
    if (!address) {
      return {
        kind: "invalid_contact_address",
        contact: label.contact,
        query: params.recipient,
      };
    }
    return { kind: "single_contact", contact: label.contact, address };
  }

  if (label.kind === "ambiguous_contact" || label.kind === "ambiguous_account") {
    return label;
  }

  const raw = params.recipient.trim().replace(/[.,!?;:]+$/, "");
  if (raw && isValidSuiNSName(raw)) {
    const suins = await resolveSuiNSName(raw, params.suiEnvironment);
    if (suins) {
      return { kind: "suins_name", displayName: suins.displayName, address: suins.address };
    }
  }

  if (label.kind === "none") {
    return label;
  }

  return { kind: "none", query: params.recipient };
}
