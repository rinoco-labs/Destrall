/**
 * Future: single PTB or ordered execution after composite approval.
 * Today swaps and Navi steps are approved on their respective cards in order.
 */
export type CompositeExecutionStage = "swap" | "deposit";

export function describeCompositeExecutionOrder(): CompositeExecutionStage[] {
  return ["swap", "deposit"];
}
