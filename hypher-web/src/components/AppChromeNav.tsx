"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

type Props = {
  /** Fixed top-right (capture) vs inline in main toolbar (workspace) */
  layout: "floating" | "toolbar";
  showSearch?: boolean;
  onSearchClick?: () => void;
};

export function AppChromeNav({ layout, showSearch, onSearchClick }: Props) {
  const navClass = layout === "floating" ? "app-chrome-nav app-chrome-nav--floating" : "main-toolbar__end";

  return (
    <div className={navClass}>
      <Link href="/app/settings/api-keys" className="main-toolbar-settings">
        API keys
      </Link>
      <Link href="/app/settings/integrations" className="main-toolbar-settings">
        Integrations
      </Link>
      <UserButton />
      {showSearch && onSearchClick ? (
        <button type="button" className="btn-search" onClick={onSearchClick} aria-label="Search">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={14} height={14}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          Search
          <kbd className="toolbar-kbd">⌘K</kbd>
        </button>
      ) : null}
    </div>
  );
}
