import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type FeatureFlags = {
  showItemsPage: boolean;
  showAddUnitButton: boolean;
  repairTracking: boolean;
  creditInstallments: boolean;
  customerCRM: boolean;
  expenseTracking: boolean;
  staffPermissions: boolean;
  chartsAnalytics: boolean;
  reports: boolean;
  consignment: boolean;
  loans: boolean;
  stockCount: boolean;
  restockIntelligence: boolean;
  announcements: boolean;
  receiptScanner: boolean;
  usageAnalytics: boolean;
};

export const FLAG_DEFAULTS: FeatureFlags = {
  showItemsPage: false,
  showAddUnitButton: true,
  repairTracking: true,
  creditInstallments: true,
  customerCRM: true,
  expenseTracking: true,
  staffPermissions: true,
  chartsAnalytics: true,
  reports: true,
  consignment: true,
  loans: true,
  stockCount: true,
  restockIntelligence: true,
  announcements: true,
  receiptScanner: true,
  usageAnalytics: true,
};

export function useFeatureFlags() {
  const qc = useQueryClient();

  const { data: flags = FLAG_DEFAULTS } = useQuery<FeatureFlags>({
    queryKey: ["feature-flags"],
    queryFn: () => api.get<FeatureFlags>("/settings/features"),
    staleTime: 60_000,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (next: FeatureFlags) =>
      api.put<FeatureFlags>("/settings/features", next),
    onSuccess: (data) => {
      qc.setQueryData(["feature-flags"], data);
    },
  });

  const setFlag = (key: keyof FeatureFlags, value: boolean) => {
    const next = { ...flags, [key]: value };
    mutation.mutate(next);
  };

  return { flags, setFlag, saving: mutation.isPending };
}

export function readFeatureFlag(key: keyof FeatureFlags): boolean {
  return FLAG_DEFAULTS[key];
}
