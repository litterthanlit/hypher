import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { createClient } from "./api";
import type { HypherContextValue, Project } from "./types";

const HypherContext = createContext<HypherContextValue | null>(null);

export function HypherProvider({
  children,
  apiKey,
  baseUrl,
}: {
  children: React.ReactNode;
  apiKey: string;
  baseUrl?: string;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const client = useMemo(
    () => createClient({ apiKey, baseUrl }),
    [apiKey, baseUrl]
  );

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
