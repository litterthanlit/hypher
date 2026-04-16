"use client";

import { useState, useRef, useEffect, useMemo, useDeferredValue } from "react";
import type { AnyObject, Project } from "@/types";
import { getDisplayName } from "@/types";
import { KindIcon } from "./Icons";

interface TagInfo {
  name: string;
  count: number;
}

interface Props {
  search: (query: string) => AnyObject[];
  onSelect: (id: string) => void;
  onClose: () => void;
  tags?: TagInfo[];
  onSelectTag?: (tag: string) => void;
}

type ResultItem =
  | { type: "object"; item: AnyObject }
  | { type: "tag"; item: TagInfo };

export function SearchDialog({ search, onSelect, onClose, tags = [], onSelectTag }: Props) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const isFiltering = query.trim() !== "" && query !== deferredQuery;
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const objectResults = search(deferredQuery);

  // Match tags
  const tagResults = useMemo(() => {
    if (!deferredQuery.trim()) return tags.slice(0, 5);
    const q = deferredQuery.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 5);
  }, [deferredQuery, tags]);

  // Flatten for keyboard nav
  const flat = useMemo<ResultItem[]>(() => {
    const items: ResultItem[] = [];
    // Tags first when searching
    if (deferredQuery.trim() && tagResults.length > 0) {
      for (const t of tagResults) items.push({ type: "tag", item: t });
    }
    for (const o of objectResults.slice(0, 10)) items.push({ type: "object", item: o });
    // Show tags at bottom when empty query
    if (!deferredQuery.trim() && tagResults.length > 0) {
      for (const t of tagResults) items.push({ type: "tag", item: t });
    }
    return items;
  }, [deferredQuery, objectResults, tagResults]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setHighlightIndex(0);
  }, [deferredQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = flat[highlightIndex];
      if (selected) {
        if (selected.type === "object") {
          onSelect(selected.item.id);
        } else if (selected.type === "tag" && onSelectTag) {
          onSelectTag(selected.item.name);
        }
        onClose();
      }
    }
  };

  const getSubtext = (obj: AnyObject) => {
    if (obj.kind === "project") return (obj as Project).status;
    if (obj.kind === "note") return (obj as any).maturity;
    return (obj as any).type;
  };

  // Split flat results for rendering sections
  const tagSection = flat.filter((r): r is { type: "tag"; item: TagInfo } => r.type === "tag");
  const objectSection = flat.filter((r): r is { type: "object"; item: AnyObject } => r.type === "object");

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="search-icon">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, notes, tags..."
          />
          <kbd className="search-kbd">esc</kbd>
        </div>

        {isFiltering && (
          <div className="search-filtering-skeleton tw-animate-pulse" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="search-skeleton-row">
                <span className="search-skeleton-icon" />
                <span className="search-skeleton-line" />
              </div>
            ))}
          </div>
        )}

        {deferredQuery && !isFiltering && flat.length === 0 && (
          <div className="search-empty">No results for &ldquo;{deferredQuery}&rdquo;</div>
        )}

        {!isFiltering && flat.length > 0 && (
          <div className="search-results-grouped">
            {/* Tags section */}
            {tagSection.length > 0 && (
              <div className="search-section">
                <div className="search-section-label">Tags</div>
                <ul className="search-results">
                  {tagSection.map((r) => {
                    const idx = flat.indexOf(r);
                    return (
                      <li
                        key={`tag-${r.item.name}`}
                        className={`search-result ${idx === highlightIndex ? "highlighted" : ""}`}
                        onClick={() => { onSelectTag?.(r.item.name); onClose(); }}
                        onMouseEnter={() => setHighlightIndex(idx)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={14} height={14} className="kind-icon">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                        </svg>
                        <span className="search-result-name">{r.item.name}</span>
                        <span className="search-result-kind">{r.item.count} items</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Objects section */}
            {objectSection.length > 0 && (
              <div className="search-section">
                {tagSection.length > 0 && <div className="search-section-label">Items</div>}
                <ul className="search-results">
                  {objectSection.map((r) => {
                    const idx = flat.indexOf(r);
                    const obj = r.item;
                    return (
                      <li
                        key={obj.id}
                        className={`search-result ${idx === highlightIndex ? "highlighted" : ""}`}
                        onClick={() => { onSelect(obj.id); onClose(); }}
                        onMouseEnter={() => setHighlightIndex(idx)}
                      >
                        <KindIcon kind={obj.kind} className="kind-icon" />
                        <span className="search-result-name">{getDisplayName(obj)}</span>
                        {obj.tags && obj.tags.length > 0 && (
                          <span className="search-result-tags">
                            {obj.tags.slice(0, 2).map((t) => (
                              <span key={t} className="search-tag-pill">{t}</span>
                            ))}
                          </span>
                        )}
                        <span className="search-result-kind">{getSubtext(obj)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {!deferredQuery && flat.length === 0 && (
          <div className="search-hints">
            <span>Type to search across all projects, notes, and tags</span>
          </div>
        )}

        <div className="search-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
