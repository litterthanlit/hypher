"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";

interface Props {
  open: boolean;
  onComplete: () => void;
}

type Step = "idle" | "importing" | "success";

export function WelcomeDialog({ open, onComplete }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; capped: boolean } | null>(null);
  const startedRef = useRef(false);

  const progress = useQuery(
    api.notion.getImportProgress,
    open && step === "importing" ? {} : "skip"
  );

  // Resume after Notion OAuth redirect.
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const notion = params.get("notion");
    if (!notion) return;

    params.delete("notion");
    params.delete("reason");
    const search = params.toString();
    window.history.replaceState({}, "", search ? `/app?${search}` : "/app");

    if (notion === "connected") {
      setStep("importing");
    } else if (notion === "error") {
      const reason = new URLSearchParams(window.location.search).get("reason");
      setError(
        reason === "not_configured"
          ? "Notion integration isn't configured yet."
          : "Notion connection failed. Please try again."
      );
    }
  }, [open]);

  // Kick off the import once we enter the importing step.
  const runImport = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    try {
      const res = await fetch("/api/notion-import", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setImportResult({ imported: data.imported ?? 0, capped: !!data.capped });
      setStep("success");
    } catch (e) {
      console.error("[WelcomeDialog] import failed", e);
      setError(e instanceof Error ? e.message : "Import failed");
      setStep("idle");
      startedRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (step === "importing") runImport();
  }, [step, runImport]);

  const handleConnectNotion = () => {
    setError(null);
    window.location.href = "/api/notion/authorize";
  };

  const handleStartFresh = () => {
    onComplete();
  };

  const handleDone = async () => {
    onComplete();
    if (importResult && importResult.imported > 0) {
      toast.success(`Imported ${importResult.imported} items from Notion`);
    }
  };

  if (!open) return null;

  const importedCount = progress?.imported ?? 0;
  const totalCount = progress?.total ?? 0;
  const progressPct = totalCount > 0 ? Math.round((importedCount / totalCount) * 100) : 0;

  return (
    <AnimatePresence>
      <motion.div
        className="welcome-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="welcome-card"
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {step === "idle" && (
            <>
              <h1 className="welcome-title">Welcome to Hypher</h1>
              <p className="welcome-subtitle">
                A quiet home for the thinking you already do. Bring your notes with
                you — or start with a blank canvas.
              </p>
              {error && <div className="welcome-error">{error}</div>}
              <div className="welcome-cta-stack">
                <button className="welcome-cta-primary" onClick={handleConnectNotion}>
                  Import from Notion
                </button>
                <button className="welcome-cta-secondary" onClick={handleStartFresh}>
                  Start fresh
                </button>
              </div>
              <p className="welcome-fineprint">
                Notion pages are imported into your Hypher workspace. You can
                disconnect any time in Settings.
              </p>
            </>
          )}

          {step === "importing" && (
            <div className="welcome-step-loading">
              <h2 className="welcome-title">Importing from Notion</h2>
              <p className="welcome-subtitle">
                {totalCount > 0
                  ? `Importing ${importedCount}/${totalCount}…`
                  : "Fetching your pages…"}
              </p>
              <div className="welcome-progress">
                <div
                  className="welcome-progress-bar"
                  style={{ width: `${totalCount > 0 ? progressPct : 8}%` }}
                />
              </div>
              <p className="welcome-fineprint">
                This can take a moment for large workspaces.
              </p>
            </div>
          )}

          {step === "success" && importResult && (
            <div className="welcome-step-success">
              <h2 className="welcome-title">You&apos;re in</h2>
              <p className="welcome-subtitle">
                {importResult.imported === 0
                  ? "No pages found yet — you can import more later from Settings → Integrations."
                  : importResult.capped
                    ? `Imported ${importResult.imported} pages from Notion. You can import the rest anytime from Settings → Integrations.`
                    : `Imported ${importResult.imported} ${importResult.imported === 1 ? "page" : "pages"} from Notion.`}
              </p>
              <div className="welcome-cta-stack">
                <button className="welcome-cta-primary" onClick={handleDone}>
                  Open my workspace
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
