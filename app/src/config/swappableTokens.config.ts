/**
 * Chain-separated list of tokens the assistant may offer as swap outputs.
 * Input spend assets are always resolved from the active wallet; this config is not used for ownership.
 */
export const swappableTokensConfig = {
  sui: {
    tokens: [
      {
        symbol: "SUI",
        name: "Sui",
        address: "0x2::sui::SUI",
        coinType: "0x2::sui::SUI",
        decimals: 9,
      },
      {
        symbol: "DEEP",
        name: "DeepBook",
        address:
          "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
        coinType:
          "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
        decimals: 6,
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        address:
          "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
        coinType:
          "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
        decimals: 6,
      },
      {
        symbol: "WAL",
        name: "Walrus",
        address:
          "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL",
        coinType:
          "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL",
        decimals: 9,
      },
    ],
  },
  solana: {
    tokens: [],
  },
} as const;

export type SwappableTokensConfig = typeof swappableTokensConfig;
