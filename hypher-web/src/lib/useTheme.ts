"use client";

import { useState, useEffect } from "react";

export interface CanvasTheme {
  nodeFill: string;
  nodeStroke: string;
  label: string;
  labelHover: string;
  accent: string;
  blue: string;
  amber: string;
  linkColor: string;
  linkSuggested: string;
  glowAlpha: number;
  organismFill: string;
  organismStroke: string;
}

function readTheme(): CanvasTheme {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    nodeFill: v("--canvas-node-fill") || "#111111",
    nodeStroke: v("--canvas-node-stroke") || "rgba(255,255,255,0.08)",
    label: v("--canvas-label") || "#a1a1a1",
    labelHover: v("--canvas-label-hover") || "#ededed",
    accent: v("--accent") || "#3ecf8e",
    blue: v("--blue") || "#0091ff",
    amber: v("--amber") || "#ffb224",
    linkColor: v("--canvas-link") || "rgba(62,207,142,0.15)",
    linkSuggested: v("--canvas-link-suggested") || "rgba(62,207,142,0.08)",
    glowAlpha: parseFloat(v("--canvas-glow-alpha")) || 0.12,
    organismFill: v("--canvas-organism-fill") || "#0d0d0d",
    organismStroke: v("--canvas-organism-stroke") || "rgba(255,255,255,0.06)",
  };
}

export function useCanvasTheme(): CanvasTheme {
  const [theme, setTheme] = useState<CanvasTheme>(() => {
    if (typeof window === "undefined") {
      return {
        nodeFill: "#111111", nodeStroke: "rgba(255,255,255,0.08)",
        label: "#a1a1a1", labelHover: "#ededed",
        accent: "#3ecf8e", blue: "#0091ff", amber: "#ffb224",
        linkColor: "rgba(62,207,142,0.15)", linkSuggested: "rgba(62,207,142,0.08)",
        glowAlpha: 0.12, organismFill: "#0d0d0d", organismStroke: "rgba(255,255,255,0.06)",
      };
    }
    return readTheme();
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(readTheme());
    mq.addEventListener("change", update);
    // Initial read after mount
    update();
    return () => mq.removeEventListener("change", update);
  }, []);

  return theme;
}

export function useTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return theme;
}
