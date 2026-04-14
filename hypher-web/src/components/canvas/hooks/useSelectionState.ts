"use client";

import { useState, useCallback, useMemo } from "react";

export function useSelectionState() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const primarySelectedId = useMemo(() => {
    const arr = Array.from(selectedIds);
    return arr.length > 0 ? arr[0] : null;
  }, [selectedIds]);

  const select = useCallback((id: string) => {
    if (!id) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set([id]));
    }
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return {
    selectedIds,
    primarySelectedId,
    select,
    toggleSelect,
    selectAll,
    clearSelection,
    isSelected,
    selectionCount: selectedIds.size,
  };
}
