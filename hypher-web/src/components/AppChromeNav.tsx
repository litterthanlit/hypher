"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

type Props = {
  /** Fixed top-right (capture) vs inline in main toolbar (workspace) */
  layout: "floating" | "toolbar";
  showSearch?: boolean;
  onSearchClick?: () => void;
  onFeedbackClick?: () => void;
  showBetaAdmin?: boolean;
};

export function AppChromeNav({ layout, showSearch, onSearchClick, onFeedbackClick, showBetaAdmin }: Props) {
  const navClass = layout === "floating" ? "app-chrome-nav app-chrome-nav--floating" : "main-toolbar__end";

  return (
    <div className={navClass}>
      {showSearch && onSearchClick ? (
        <button type="button" className="btn-search" onClick={onSearchClick} aria-label="Search">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={14} height={14}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          Search
          <kbd className="toolbar-kbd">⌘K</kbd>
        </button>
      ) : null}
      {onFeedbackClick ? (
        <button type="button" className="main-toolbar-settings main-toolbar-feedback" onClick={onFeedbackClick}>
          Feedback
        </button>
      ) : null}
      {showBetaAdmin ? (
        <Link href="/app/settings/beta" className="main-toolbar-settings">
          Beta
        </Link>
      ) : null}
      <Link href="/app/settings" className="main-toolbar-settings">
        Settings
      </Link>
      <UserButton />
    </div>
  );
}
