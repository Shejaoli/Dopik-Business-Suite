import { useState, useCallback } from "react";

export type FeatureFlags = {
  showItemsPage: boolean;
  showAddUnitButton: boolean;
};

const STORAGE_KEY = "dopik_feature_flags_v1";

const DEFAULTS: FeatureFlags = {
  showItemsPage: false,
  showAddUnitButton: true,
};

function readFlags(): FeatureFlags {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

export function useFeatureFlags() {
  const [flags, setFlagsState] = useState<FeatureFlags>(readFlags);

  const setFlag = useCallback((key: keyof FeatureFlags, value: boolean) => {
    setFlagsState(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { flags, setFlag };
}

export function readFeatureFlag(key: keyof FeatureFlags): boolean {
  return readFlags()[key];
}
