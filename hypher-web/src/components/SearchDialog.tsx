"use client";

import { useState, useRef, useEffect } from "react";
import type { AnyObject } from "@/types";
import { getDisplayName } from "@/types";
import { KindIcon } from "./Icons";

interface Props {
  search: (query: string) => AnyObject[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function SearchDialog({ search, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = search(query);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[highlightIndex]) {
      onSelect(results[highlightIndex].id);
      onClose();
    }
  };

  const getSubtext = (obj: AnyObject) => {
    if (obj.kind === "project") return obj.status;
    if (obj.kind === "note") return obj.maturity;
    return obj.type;
  };

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
            placeholder="Search objects..."
          />
          <kbd className="search-kbd">esc</kbd>
        </div>

        {query && results.length === 0 && (
          <div className="search-empty">No results for &ldquo;{query}&rdquo;</div>
        )}

        {results.length > 0 && (
          <ul className="search-results">
            {results.slice(0, 10).map((obj, i) => (
              <li
                key={obj.id}
                className={`search-result ${i === highlightIndex ? "highlighted" : ""}`}
                onClick={() => { onSelect(obj.id); onClose(); }}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                <KindIcon kind={obj.kind} className="kind-icon" />
                <span className="search-result-name">{getDisplayName(obj)}</span>
                <span className="search-result-kind">{getSubtext(obj)}</span>
              </li>
            ))}
          </ul>
        )}

        {!query && (
          <div className="search-hints">
            <span>Type to search across all objects</span>
          </div>
        )}
      </div>
    </div>
  );
}
