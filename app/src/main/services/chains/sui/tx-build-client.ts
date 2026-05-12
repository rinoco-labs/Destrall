export type UnsignedSuiTransaction = {
  kind: "sui-unsigned-transaction";
  bytesBase64: string;
};

export class SuiTxBuildClient {
  // Thin placeholder for future transaction preparation without pulling in @mysten/sui.
  prepareUnsignedTransaction(bytesBase64: string): UnsignedSuiTransaction {
    return { kind: "sui-unsigned-transaction", bytesBase64 };
  }
}
