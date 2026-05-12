export type SuiNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

const DEFAULT_RPC: Record<SuiNetwork, string> = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
  localnet: "http://127.0.0.1:9000",
};

export function getSuiRpcUrl(network: SuiNetwork = "devnet"): string {
  return DEFAULT_RPC[network];
}

export class SuiClientService {
  constructor(private readonly rpcUrl: string) {}

  async getBalance(address: string): Promise<{ totalBalance: string }> {
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getBalance",
        params: [address],
      }),
    });
    if (!response.ok) {
      throw new Error(`Sui RPC request failed (${response.status})`);
    }
    const payload = (await response.json()) as {
      result?: { totalBalance: string };
      error?: { message?: string };
    };
    if (payload.error?.message) {
      throw new Error(payload.error.message);
    }
    return { totalBalance: payload.result?.totalBalance ?? "0" };
  }
}

export function createSuiClient(network: SuiNetwork = "devnet"): SuiClientService {
  return new SuiClientService(getSuiRpcUrl(network));
}
