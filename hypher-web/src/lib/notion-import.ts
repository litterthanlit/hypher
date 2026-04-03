// Notion import data structure
// This file is populated by the import script and loaded into the app

export interface NotionPage {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  isProject: boolean;
  parentProject?: string;
}

// Mapping of Notion pages to Hypher projects
export const PROJECT_PAGES = [
  "Hypher",
  "Marque",
  "Litt.designs",
  "Ergon",
  "COLOSSAL PROJECTS",
];

export function classifyPage(title: string): { isProject: boolean; parentProject?: string } {
  // Direct project matches
  for (const p of PROJECT_PAGES) {
    if (title.toLowerCase().includes(p.toLowerCase())) {
      return { isProject: true };
    }
  }

  // Studio OS related
  if (title.toLowerCase().includes("studio os") || title.match(/^v\d/)) {
    return { isProject: false, parentProject: "Studio OS" };
  }

  // Content related
  if (title.toLowerCase().includes("content") || title.toLowerCase().includes("week")) {
    return { isProject: false, parentProject: "Content" };
  }

  // Everything else goes to inbox
  return { isProject: false };
}
