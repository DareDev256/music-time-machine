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

/** Type-safe initial state factory — avoids `as` cast from `AsyncState<never>`. */
function createIdle<T>(): AsyncState<T> {
  return { status: "idle", data: null, error: null };
}

/** Extract an error message without unsafe `as Error` casts. */
function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || "An error occurred";
  if (typeof err === "string") return err || "An error occurred";
  return "An error occurred";
}

/** Check if an unknown caught value is an AbortError. */
function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

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
  const [state, dispatch] = useReducer(reducer<T>, createIdle<T>());

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "FETCH" });

    fetcher(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "SUCCESS", data });
        }
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return;
        console.error("useAsyncData fetch error:", err);
        dispatch({
          type: "ERROR",
          error: toErrorMessage(err),
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
