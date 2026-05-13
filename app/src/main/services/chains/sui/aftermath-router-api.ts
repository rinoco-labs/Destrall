import type { SuiChainEnvironment } from "../../../../config/chains/sui";

/**
 * Aftermath Smart Order Router REST shape (subset used by Destrall).
 * Aligned with `expo/services/swap/aftermath-router.service.ts` — same paths and JSON bigint encoding.
 */
export type AftermathTradeRoute = {
  coinIn: { type: string; amount: unknown; tradeFee?: unknown };
  coinOut: { type: string; amount: unknown; tradeFee?: unknown };
  routes: Array<{
    paths: Array<{ protocolName: string }>;
  }>;
  netTradeFeePercentage?: number;
  spotPrice?: number;
  externalFee?: { recipient: string; feePercentage: number };
  slippage?: number;
};

export function getAftermathRouterBaseUrl(env: SuiChainEnvironment): string {
  if (env === "mainnet") return "https://aftermath.finance";
  if (env === "testnet") return "https://testnet.aftermath.finance";
  throw new Error("Swaps are not supported on Devnet.");
}

/** Match Expo / aftermath-ts-sdk POST bodies: bigint → decimal string + `n`. */
function bigintRequestReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString() + "n";
  }
  return value;
}

/**
 * Parse router JSON. Handles optional `123n` bigint strings (Aftermath / SDK convention).
 */
export function parseAftermathRouterJson(text: string): unknown {
  return JSON.parse(text, (_key, value) => {
    if (typeof value === "string" && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  });
}

export async function aftermathRouterRequest<T>(params: {
  env: SuiChainEnvironment;
  path: string;
  body?: unknown;
}): Promise<T> {
  const base = getAftermathRouterBaseUrl(params.env);
  const url = `${base}/api/router/${params.path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const response =
    params.body === undefined
      ? await fetch(url, { headers })
      : await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(params.body, bigintRequestReplacer),
        });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `HTTP ${response.status} ${response.statusText}${errText ? `: ${errText}` : ""}`,
    );
  }

  const text = await response.text();
  return parseAftermathRouterJson(text) as T;
}
