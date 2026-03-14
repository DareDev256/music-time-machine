"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { RecommendationPrefs, SelectionStrategy } from "@/lib/recommendations";

const STORAGE_KEY = "mtm-rec-prefs";

interface PrefsState {
  prefs: RecommendationPrefs;
  strategy: SelectionStrategy;
}

type PrefsAction =
  | { type: "SET_PREFS"; prefs: RecommendationPrefs }
  | { type: "SET_STRATEGY"; strategy: SelectionStrategy }
  | { type: "SYNC" };

function readStorage(): PrefsState {
  if (typeof window === "undefined") return { prefs: {}, strategy: "auto" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { prefs: {}, strategy: "auto" };
    const parsed = JSON.parse(raw);
    return {
      prefs: parsed.prefs ?? {},
      strategy: parsed.strategy ?? "auto",
    };
  } catch {
    return { prefs: {}, strategy: "auto" };
  }
}

function writeStorage(state: PrefsState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Reducer always re-reads from localStorage after writes.
 * This breaks the stale-closure cycle caused by React 19 automatic batching —
 * every mutation round-trips through the persisted source of truth.
 */
function prefsReducer(_prev: PrefsState, action: PrefsAction): PrefsState {
  switch (action.type) {
    case "SET_PREFS": {
      const current = readStorage();
      const next = { ...current, prefs: action.prefs };
      writeStorage(next);
      return readStorage(); // re-read: source of truth
    }
    case "SET_STRATEGY": {
      const current = readStorage();
      const next = { ...current, strategy: action.strategy };
      writeStorage(next);
      return readStorage();
    }
    case "SYNC":
      return readStorage();
    default:
      return _prev;
  }
}

interface PrefsContextValue {
  prefs: RecommendationPrefs;
  strategy: SelectionStrategy;
  setPrefs: (prefs: RecommendationPrefs) => void;
  setStrategy: (strategy: SelectionStrategy) => void;
  reset: () => void;
}

const PrefsContext = createContext<PrefsContextValue>({
  prefs: {},
  strategy: "auto",
  setPrefs: () => {},
  setStrategy: () => {},
  reset: () => {},
});

export function usePrefs(): PrefsContextValue {
  return useContext(PrefsContext);
}

export default function PrefsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(prefsReducer, undefined, readStorage);

  // Cross-tab sync via storage event
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) dispatch({ type: "SYNC" });
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPrefs = useCallback(
    (prefs: RecommendationPrefs) => dispatch({ type: "SET_PREFS", prefs }),
    [],
  );

  const setStrategy = useCallback(
    (strategy: SelectionStrategy) => dispatch({ type: "SET_STRATEGY", strategy }),
    [],
  );

  const reset = useCallback(() => {
    dispatch({ type: "SET_PREFS", prefs: {} });
    dispatch({ type: "SET_STRATEGY", strategy: "auto" });
  }, []);

  return (
    <PrefsContext.Provider
      value={{ prefs: state.prefs, strategy: state.strategy, setPrefs, setStrategy, reset }}
    >
      {children}
    </PrefsContext.Provider>
  );
}
