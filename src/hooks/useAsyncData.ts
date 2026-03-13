"use client";

import { useEffect, useReducer } from "react";

// ── Discriminated union: only valid state combinations exist ──────────
type AsyncState<T> =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type Action<T> =
  | { type: "FETCH" }
  | { type: "SUCCESS"; data: T }
  | { type: "ERROR"; error: string };

function reducer<T>(_: AsyncState<T>, action: Action<T>): AsyncState<T> {
  switch (action.type) {
    case "FETCH":
      return { status: "loading", data: null, error: null };
    case "SUCCESS":
      return { status: "success", data: action.data, error: null };
    case "ERROR":
      return { status: "error", data: null, error: action.error };
  }
}

const IDLE: AsyncState<never> = { status: "idle", data: null, error: null };

/**
 * Generic async fetch hook backed by `useReducer`.
 *
 * Replaces the repeated `useState(data) + useState(loading) + useState(error)`
 * pattern with a single discriminated-union state machine that makes impossible
 * states (e.g. loading + error) unrepresentable.
 *
 * Includes `AbortController` cleanup — stale fetches from previous renders are
 * cancelled before new ones fire, preventing React 19 batching edge-cases.
 *
 * @param fetcher  Async function that receives an `AbortSignal` and returns `T`.
 * @param deps     Dependency array — re-fetches whenever any dep changes.
 */
export function useAsyncData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList,
): { data: T | null; loading: boolean; error: string | null } {
  const [state, dispatch] = useReducer(reducer<T>, IDLE as AsyncState<T>);

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "FETCH" });

    fetcher(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "SUCCESS", data });
        }
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        console.error("useAsyncData fetch error:", err);
        dispatch({
          type: "ERROR",
          error: (err as Error).message || "An error occurred",
        });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps controlled by caller
  }, deps);

  return {
    data: state.data,
    loading: state.status === "loading",
    error: state.error,
  };
}
