import { useConfig } from "@/app/hooks/useConfig";

export const useIsSubscriptionMode = (): boolean => {
  const { config } = useConfig();
  return config?.usageMode === "subscription";
};
