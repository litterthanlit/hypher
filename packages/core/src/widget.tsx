import React, { useState, useCallback } from "react";
import { useHypher } from "./hooks";
import type { CaptureWidgetProps } from "./types";

const POSITION_STYLES: Record<string, React.CSSProperties> = {
  "bottom-right": { position: "fixed", bottom: 20, right: 20 },
  "bottom-left": { position: "fixed", bottom: 20, left: 20 },
  "top-right": { position: "fixed", top: 20, right: 20 },
  "top-left": { position: "fixed", top: 20, left: 20 },
  inline: { position: "relative" },
};

export function CaptureWidget({
  placeholder = "Capture a thought...",
  defaultProjectId,
  position = "bottom-right",
  onCapture,
  onError,
}: CaptureWidgetProps) {
  const { capture, projects } = useHypher();
  const [value, setValue] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!value.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await capture({
        content: value.trim(),
        projectId,
      });
      setValue("");
      setIsExpanded(false);
      onCapture?.(result.id);
    } catch (err) {
      onError?.(err as Error);
    } finally {
      setIsSubmitting(false);
    }
  }, [value, projectId, capture, onCapture, onError, isSubmitting]);

  return (
    <div style={POSITION_STYLES[position]} data-hypher-widget>
      <div
        style={{
          background: "white",
          borderRadius: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          padding: 12,
          minWidth: isExpanded ? 300 : 200,
          transition: "all 200ms ease",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={placeholder}
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            fontSize: 14,
            padding: "8px 0",
            background: "transparent",
            color: "#1a1a1a",
          }}
        />

        {isExpanded && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid #eee",
            }}
          >
            <select
              value={projectId || ""}
              onChange={(e) => setProjectId(e.target.value || undefined)}
              style={{
                fontSize: 12,
                padding: 4,
                borderRadius: 4,
                border: "1px solid #ddd",
              }}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleSubmit}
              disabled={!value.trim() || isSubmitting}
              style={{
                background: "#2d9d6a",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 12,
                cursor: "pointer",
                opacity: !value.trim() || isSubmitting ? 0.5 : 1,
              }}
            >
              {isSubmitting ? "..." : "Capture"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
