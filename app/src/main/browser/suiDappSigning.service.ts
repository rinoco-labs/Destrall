import { bcs } from "@mysten/bcs";
import { blake2b } from "@noble/hashes/blake2.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { messageWithIntent, toSerializedSignature } from "@mysten/sui/cryptography";
import { walletSession } from "../wallet/walletSession";
import { walletService } from "../wallet/walletService";
import { deriveSuiAccountFromMnemonic } from "../services/chains/sui/sui-wallet.service";
import { signSuiTransactionDataEd25519 } from "../services/chains/sui/sui-ed25519-tx-signer";
import { getSuiClientForEnvironment } from "../services/chains/sui/sui-client.service";
import { networkSettingsService } from "../services/network/networkSettingsService";
import { getTransactionExplorerUrl } from "../services/chains/sui/sui-explorer.service";
import { originPermissionsService } from "./originPermissions.service";
import { resolveTransactionBytesFromDappJson } from "../../services/transactions/decodeTransaction.service";

function assertUnlocked() {
  if (!walletSession.isUnlocked()) {
    throw new Error("Wallet is locked. Unlock Destrall to continue.");
  }
}

function assertOriginAuthorized(origin: string, accountId: string, permission: "signMessage" | "signTransaction" | "executeTransaction") {
  if (!originPermissionsService.isAuthorized({ accountId, origin, chain: "sui", permission })) {
    throw new Error("Origin is not authorized for this action. Connect the dapp first.");
  }
}

function decodeBase64OrUtf8(value: string): Uint8Array {
  const trimmed = value.replace(/\s+/g, "");
  try {
    if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
      const decoded = Buffer.from(trimmed, "base64");
      if (decoded.length > 0) return new Uint8Array(decoded);
    }
  } catch {
    /* fall through */
  }
  return new Uint8Array(Buffer.from(value, "utf8"));
}

function signPersonalMessageSerialized(secretKey32: Uint8Array, messageBytes: Uint8Array): string {
  const intentPayload = bcs.byteVector().serialize(messageBytes).toBytes();
  const digest = blake2b(messageWithIntent("PersonalMessage", intentPayload), { dkLen: 32 });
  const sig = ed25519.sign(digest, secretKey32);
  const publicKey = ed25519.getPublicKey(secretKey32);
  return toSerializedSignature({
    signature: sig,
    signatureScheme: "ED25519",
    publicKey: { toRawBytes: () => publicKey } as never,
  });
}

function deriveSigningKey(accountId: string) {
  assertUnlocked();
  const account = walletService.getWalletAccount(accountId);
  if (!account || account.chain !== "sui") {
    throw new Error("Active Sui account not found.");
  }
  const mnemonic = walletSession.getMnemonic();
  if (!mnemonic) throw new Error("Wallet is locked. Unlock Destrall to continue.");
  const keyMaterial = deriveSuiAccountFromMnemonic(mnemonic, account.accountIndex);
  if (keyMaterial.address !== account.address) {
    throw new Error("Signing key does not match active account.");
  }
  return { account, keyMaterial };
}

export const suiDappSigningService = {
  signPersonalMessage(params: { accountId: string; origin: string; messageBase64: string }) {
    assertOriginAuthorized(params.origin, params.accountId, "signMessage");
    const { keyMaterial } = deriveSigningKey(params.accountId);
    const messageBytes = decodeBase64OrUtf8(params.messageBase64);
    const signature = signPersonalMessageSerialized(keyMaterial.privateKey, messageBytes);
    originPermissionsService.touchLastUsed(params.accountId, params.origin, "sui");
    return {
      bytes: params.messageBase64,
      signature,
    };
  },

  async signTransaction(params: { accountId: string; origin: string; txDataJson: string }) {
    assertOriginAuthorized(params.origin, params.accountId, "signTransaction");
    const { account, keyMaterial } = deriveSigningKey(params.accountId);
    const client = getSuiClientForEnvironment(networkSettingsService.getSuiEnvironment());
    const txBytes = await resolveTransactionBytesFromDappJson(params.txDataJson, {
      client,
      sender: account.address,
    });
    const signature = signSuiTransactionDataEd25519(keyMaterial.privateKey, txBytes);
    originPermissionsService.touchLastUsed(params.accountId, params.origin, "sui");
    return {
      bytes: Buffer.from(txBytes).toString("base64"),
      signature,
    };
  },

  async signAndExecuteTransaction(params: {
    accountId: string;
    origin: string;
    txDataJson: string;
  }) {
    assertOriginAuthorized(params.origin, params.accountId, "executeTransaction");
    const { account, keyMaterial } = deriveSigningKey(params.accountId);
    const env = networkSettingsService.getSuiEnvironment();
    const client = getSuiClientForEnvironment(env);
    const txBytes = await resolveTransactionBytesFromDappJson(params.txDataJson, {
      client,
      sender: account.address,
    });
    const signature = signSuiTransactionDataEd25519(keyMaterial.privateKey, txBytes);

    try {
      const result = await client.executeTransactionBlock({
        transactionBlock: txBytes,
        signature,
        options: { showEffects: true },
      });
      originPermissionsService.touchLastUsed(params.accountId, params.origin, "sui");
      return {
        digest: result.digest,
        signature,
        effects: result.effects ?? null,
        explorerUrl: getTransactionExplorerUrl(env, result.digest),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[browser] dapp execute failed (sanitized)", msg);
      throw new Error("Transaction execution failed. Check balance and network, then try again.");
    }
  },
};
