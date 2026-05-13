import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type OnboardingState = {
  walletSetupComplete: boolean;
  aiModelSetupComplete: boolean;
  onboardingComplete: boolean;
  currentStep: string | null;
  setWalletSetupComplete: (v: boolean) => void;
  setAiModelSetupComplete: (v: boolean) => void;
  setOnboardingComplete: (v: boolean) => void;
  setCurrentStep: (s: string | null) => void;
  reset: () => void;
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      walletSetupComplete: false,
      aiModelSetupComplete: false,
      onboardingComplete: false,
      currentStep: null as string | null,
      setWalletSetupComplete: (walletSetupComplete) => set({ walletSetupComplete }),
      setAiModelSetupComplete: (aiModelSetupComplete) => set({ aiModelSetupComplete }),
      setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
      setCurrentStep: (currentStep) => set({ currentStep }),
      reset: () =>
        set({
          walletSetupComplete: false,
          aiModelSetupComplete: false,
          onboardingComplete: false,
          currentStep: null as string | null,
        }),
    }),
    {
      name: "destrall.onboarding",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? (undefined as unknown as Storage)
          : localStorage,
      ),
    },
  ),
);
