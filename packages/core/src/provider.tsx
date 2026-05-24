import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { createBrowserClient } from "./browser";
import type { CaptureTokenProvider, HypherContextValue, Project } from "./types";

const HypherContext = createContext<HypherContextValue | null>(null);

export function HypherProvider({
  children,
  tokenProvider,
  apiKey,
  baseUrl,
}: {
  children: React.ReactNode;
  tokenProvider?: CaptureTokenProvider;
  /** @deprecated Use tokenProvider with POST /api/capture-tokens. */
  apiKey?: string;
  baseUrl?: string;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const client = useMemo(() => {
    const provider = tokenProvider ?? (() => {
      if (!apiKey) throw new Error("HypherProvider requires a capture token provider");
      console.warn(
        "[hypher] Browser apiKey usage is deprecated. Use tokenProvider with short-lived capture tokens."
      );
      return apiKey;
    });
    return createBrowserClient({ tokenProvider: provider, baseUrl });
  }, [apiKey, baseUrl, tokenProvider]);

  useEffect(() => {
    client
      .getProjects()
      .then(setProjects)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [client]);

  const value: HypherContextValue = {
    capture: client.capture,
    projects,
    isLoading,
    error,
  };

  return (
    <HypherContext.Provider value={value}>{children}</HypherContext.Provider>
  );
}

export function useHypherContext() {
  const ctx = useContext(HypherContext);
  if (!ctx)
    throw new Error("useHypherContext must be used within HypherProvider");
  return ctx;
}
