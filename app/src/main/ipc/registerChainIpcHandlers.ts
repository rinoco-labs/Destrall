import { BrowserWindow, ipcMain } from "electron";
import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils";
import { IPCChannels, type ChainNetworkStatePayload } from "../../shared/ipc";
import type { SwapProposalSnapshotV1 } from "@packages/core/swap/swap.types";
import {
  chainAccountIdSchema,
  chainActivitySchema,
  chainConfirmTransferSchema,
  chainExecuteCompositeSchema,
  chainExecuteNaviYieldSchema,
  chainExecuteRebalanceSchema,
  chainExecuteSwapSchema,
  chainPrepareTransferSchema,
  chainPublishDailyBriefMemorySchema,
  chainSetNetworkSchema,
  contactsCreateSchema,
  contactsDeleteSchema,
  contactsListSchema,
  contactsUpdateSchema,
} from "./schemas";
import type { NaviYieldProposalSnapshotV1 } from "@packages/core/yield/navi/navi.types";
import { suiNaviYieldService } from "../services/chains/sui/sui-navi-yield.service";
import { chainFacadeService } from "../services/chains/chainFacadeService";
import { setDailyBriefAssistantMemory } from "../services/dailyBriefMemoryService";
import { networkSettingsService } from "../services/network/networkSettingsService";
import { assistantDataCache } from "../../assistant/cache/assistantDataCache";
import { readStoredYieldRiskProfile } from "../../packages/core/yield/navi/navi-risk.service";
import { contactRepository } from "../persistence/repositories/contactRepository";
import { SUPPORTED_CHAIN_DESCRIPTORS } from "../../config/networks";
import type { DailyBriefAssistantMemoryPayload } from "../../shared/dailyBriefMemory";

function ok<T>(data: T) {
  return { ok: true as const, data };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return { ok: false as const, error: message };
}

function broadcastChainChanged() {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPCChannels.chainNetworkChanged);
  }
}

function networkPayload(): ChainNetworkStatePayload {
  return {
    ...chainFacadeService.getNetworkSnapshot(),
    supportedChains: SUPPORTED_CHAIN_DESCRIPTORS,
  };
}

export function registerChainIpcHandlers() {
  networkSettingsService.initializeNetworkState();

  ipcMain.handle(IPCChannels.chainGetNetworkState, async () => {
    try {
      return ok(networkPayload());
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.chainSetNetwork, async (_event, payload: unknown) => {
    const parsed = chainSetNetworkSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid network request"));
    }
    try {
      chainFacadeService.setActiveChain(parsed.data.activeChain);
      chainFacadeService.setSuiNetwork(parsed.data.suiEnvironment);
      broadcastChainChanged();
      return ok(networkPayload());
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.chainGetBalances, async (_event, payload: unknown) => {
    const raw = typeof payload === "string" ? { accountId: payload } : payload;
    const parsed = chainAccountIdSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid account id"));
    }
    try {
      return ok(await chainFacadeService.getTokenBalances(parsed.data.accountId));
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.chainGetActivity, async (_event, payload: unknown) => {
    const parsed = chainActivitySchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid activity request"));
    }
    try {
      return ok(
        await chainFacadeService.getActivityPage(parsed.data.accountId, parsed.data.cursor ?? null),
      );
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.chainGetDailyBriefBundle, async (_event, payload: unknown) => {
    const raw = typeof payload === "string" ? { accountId: payload } : payload;
    const parsed = chainAccountIdSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid account id"));
    }
    try {
      const env = networkSettingsService.getSuiEnvironment();
      const riskProfile = readStoredYieldRiskProfile();
      const pools = env === "mainnet" ? await assistantDataCache.getNaviPools(env) : [];
      const positions = await assistantDataCache.getNaviPositionViews(parsed.data.accountId, env);
      return ok({ pools, positions, riskProfile });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.chainPublishDailyBriefMemory, async (_event, payload: unknown) => {
    const parsed = chainPublishDailyBriefMemorySchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid daily brief memory payload"));
    }
    try {
      setDailyBriefAssistantMemory(
        parsed.data.accountId,
        parsed.data.memory as DailyBriefAssistantMemoryPayload,
      );
      return ok({ ok: true as const });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.chainPrepareTransfer, async (_event, payload: unknown) => {
    const parsed = chainPrepareTransferSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid transfer request"));
    }
    try {
      return ok(
        await chainFacadeService.prepareTransfer(
          parsed.data as { accountId: string; recipient: string; coinType: string; amountDisplay: string },
        ),
      );
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.chainConfirmTransfer, async (_event, payload: unknown) => {
    const parsed = chainConfirmTransferSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid confirm request"));
    }
    try {
      const result = await chainFacadeService.confirmTransfer(parsed.data as { transferRequestId: string });
      broadcastChainChanged();
      return ok(result);
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.chainExecuteSwap, async (_event, payload: unknown) => {
    const parsed = chainExecuteSwapSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid swap execution request"));
    }
    try {
      const { accountId, proposalSnapshot } = parsed.data as {
        accountId: string;
        proposalSnapshot: SwapProposalSnapshotV1;
      };
      const result = await chainFacadeService.executeAssistantSwap({ accountId, proposalSnapshot });
      broadcastChainChanged();
      return ok(result);
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.chainExecuteNaviYield, async (_event, payload: unknown) => {
    const parsed = chainExecuteNaviYieldSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid Navi yield execution request"));
    }
    try {
      const { accountId, proposalSnapshot } = parsed.data as {
        accountId: string;
        proposalSnapshot: NaviYieldProposalSnapshotV1;
      };
      const result = await suiNaviYieldService.executeApprovedProposal({ accountId, proposalSnapshot });
      broadcastChainChanged();
      return ok(result);
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.chainExecuteComposite, async (_event, payload: unknown) => {
    const parsed = chainExecuteCompositeSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid composite execution request"));
    }
    try {
      const result = await chainFacadeService.executeComposite(
        parsed.data as { accountId: string; proposalSnapshot: import("@packages/runtime/composite/compositeTypes").CompositeProposalSnapshotV1 },
      );
      broadcastChainChanged();
      return ok(result);
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.chainExecuteRebalance, async (_event, payload: unknown) => {
    const parsed = chainExecuteRebalanceSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid rebalance execution request"));
    }
    try {
      const result = await chainFacadeService.executeRebalance(
        parsed.data as { accountId: string; proposalSnapshot: import("@packages/core/rebalance/rebalance.types").RebalanceProposalSnapshotV1 },
      );
      broadcastChainChanged();
      return ok(result);
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.contactsList, async (_event, payload: unknown) => {
    const parsed = contactsListSchema.safeParse(payload ?? {});
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid contacts list request"));
    }
    try {
      const rows = contactRepository.list(parsed.data.query);
      return ok(
        rows.map((r) => ({
          id: r.id,
          accountId: r.accountId,
          name: r.name,
          address: r.address,
          chain: r.chain,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      );
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.contactsCreate, async (_event, payload: unknown) => {
    const parsed = contactsCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid contact"));
    }
    try {
      let address = parsed.data.address.trim();
      if (parsed.data.chain === "sui") {
        try {
          address = normalizeSuiAddress(address);
        } catch {
          return fail(new Error("Invalid Sui address."));
        }
        if (!isValidSuiAddress(address)) {
          return fail(new Error("Invalid Sui address."));
        }
      }
      const row = contactRepository.create({
        name: parsed.data.name.trim(),
        address,
        chain: parsed.data.chain,
        accountId: parsed.data.accountId ?? null,
      });
      return ok({
        id: row.id,
        accountId: row.accountId,
        name: row.name,
        address: row.address,
        chain: row.chain,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.contactsUpdate, async (_event, payload: unknown) => {
    const parsed = contactsUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid contact update"));
    }
    try {
      const existing = contactRepository.getById(parsed.data.id);
      if (!existing) {
        return fail(new Error("Contact not found."));
      }
      let address = parsed.data.address.trim();
      if (existing.chain === "sui") {
        try {
          address = normalizeSuiAddress(address);
        } catch {
          return fail(new Error("Invalid Sui address."));
        }
        if (!isValidSuiAddress(address)) {
          return fail(new Error("Invalid Sui address."));
        }
      }
      const row = contactRepository.update({
        id: parsed.data.id,
        name: parsed.data.name.trim(),
        address,
      });
      return ok({
        id: row.id,
        accountId: row.accountId,
        name: row.name,
        address: row.address,
        chain: row.chain,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.contactsDelete, async (_event, payload: unknown) => {
    const parsed = contactsDeleteSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid delete request"));
    }
    try {
      contactRepository.delete(parsed.data.id);
      return ok({ ok: true as const });
    } catch (error) {
      return fail(error);
    }
  });
}
