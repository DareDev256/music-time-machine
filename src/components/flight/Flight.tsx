"use client";

/**
 * The flight: a full-viewport fixed canvas behind the page. Pages load it with
 * next/dynamic({ ssr: false }). It draws only the 3D timeline tree (the #1
 * trunk with its covers, the genre branches, year rings, the destination frame
 * and its branch labels); the HUD lives in the page and is fed by `onPassing`.
 *
 * Stacking: the canvas is `position: fixed; inset: 0; z-index: 0` and ignores
 * pointer events. Content that should sit on top needs `position: relative`
 * (or any positioning) and `z-index: 1`.
 */
import { useEffect, useRef, type JSX } from "react";
import { loadFlightDoc, passingAt, prepare, targetIndex, type PassingWeek } from "./data";
import type { FlightBranch } from "./labels";
import type { Tunnel } from "./tunnel";

// This module is small and loads first; it starts the week data and the three.js tunnel chunk at
// once, in parallel, instead of fetching the data only after three.js has downloaded and run.
const loadTunnel = () => import("./tunnel");
if (typeof window !== "undefined") {
  loadFlightDoc().catch(() => {});
  loadTunnel().catch(() => {});
}

export interface FlightProps {
  /** ISO date (any day; lands on the chart week in force). null = idle drift at the newest weeks. */
  target: string | null;
  onPassing?(w: PassingWeek): void;
  onArrive?(): void;
  /** 0..1 for deterministic screenshots (?freeze=). */
  freeze?: number;
  /** Increment to skip to the landing. */
  skipSignal?: number;
  /**
   * The destination week's lane #1s, labelled at their branch on landing. Lanes not
   * listed are labelled with their name only; `mine` makes that branch glow red.
   */
  branches?: FlightBranch[];
  /**
   * True from the moment the visitor presses Go until the song resolves: the camera starts
   * accelerating into the past at once and carries straight on into the flight when `target`
   * arrives. If it goes false with no target, the camera eases back to the idle drift.
   */
  pending?: boolean;
}

export type { FlightBranch, PassingWeek };

const CANVAS_STYLE = {
  position: "fixed",
  inset: 0,
  width: "100%",
  height: "100%",
  display: "block",
  zIndex: 0,
  pointerEvents: "none",
  background: "#000",
} as const;

export default function Flight({ target, onPassing, onArrive, freeze, skipSignal, branches, pending }: FlightProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tunnelRef = useRef<Tunnel | null>(null);
  const callbacks = useRef({ onPassing, onArrive });
  const latest = useRef({ target, freeze, branches, pending });
  const firstSkip = useRef(skipSignal);

  useEffect(() => {
    callbacks.current = { onPassing, onArrive };
  }, [onPassing, onArrive]);

  // mount once: fetch the weeks, build the tunnel, tear everything down on unmount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let tunnel: Tunnel | null = null;
    Promise.all([loadFlightDoc(), loadTunnel()])
      .then(([doc, { createTunnel }]) => {
        if (disposed) return;
        const data = prepare(doc);
        try {
          tunnel = createTunnel({
            canvas,
            data,
            target: latest.current.target,
            freeze: latest.current.freeze ?? null,
            branches: latest.current.branches,
            pending: latest.current.pending,
            onPassing: (w) => callbacks.current.onPassing?.(w),
            onArrive: () => callbacks.current.onArrive?.(),
          });
          tunnelRef.current = tunnel;
        } catch {
          // no WebGL: never strand the page mid-flight, report the destination and land
          const t = latest.current.target;
          if (t) {
            callbacks.current.onPassing?.(passingAt(data, targetIndex(data, t)));
            callbacks.current.onArrive?.();
          }
        }
      })
      .catch(() => {
        if (!disposed && latest.current.target) callbacks.current.onArrive?.();
      });
    return () => {
      disposed = true;
      tunnel?.dispose();
      tunnelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (latest.current.target !== target) {
      latest.current.target = target;
      tunnelRef.current?.setTarget(target);
    }
  }, [target]);

  useEffect(() => {
    if (latest.current.freeze !== freeze) {
      latest.current.freeze = freeze;
      tunnelRef.current?.setFreeze(freeze ?? null);
    }
  }, [freeze]);

  useEffect(() => {
    if (latest.current.pending !== pending) {
      latest.current.pending = pending;
      tunnelRef.current?.setPending(!!pending);
    }
  }, [pending]);

  // compare by content: pages tend to pass a fresh array every render
  const branchKey = branches ? JSON.stringify(branches) : "";
  useEffect(() => {
    if ((latest.current.branches ? JSON.stringify(latest.current.branches) : "") !== branchKey) {
      latest.current.branches = branches;
      tunnelRef.current?.setBranches(branches);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content, not identity
  }, [branchKey]);

  useEffect(() => {
    if (skipSignal !== undefined && skipSignal !== firstSkip.current) {
      firstSkip.current = skipSignal;
      tunnelRef.current?.skip();
    }
  }, [skipSignal]);

  return <canvas ref={canvasRef} aria-hidden="true" data-flight="" style={CANVAS_STYLE} />;
}
