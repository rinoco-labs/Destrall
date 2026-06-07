/** Shared wallet UI helpers (non-secret). On-chain data comes from main via IPC. */

import { formatWalletAddress } from "../../shared/formatWalletAddress";

export function shortAddr(addr: string, head = 8, tail = 6) {
  return formatWalletAddress(addr, { start: head, end: tail });
}
