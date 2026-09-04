# Styling architecture

**App UI** (signed-in dump, Pulse, settings) is styled with **semantic CSS classes** and **CSS variables** in [`src/app/globals.css`](src/app/globals.css). Prefer reusing existing classes and tokens documented in [`docs/design-tokens.md`](../../docs/design-tokens.md).

**Marketing** (landing, pricing) uses **Tailwind** with the `tw-` prefix per [`tailwind.config.ts`](tailwind.config.ts). Marketing should map radii and neutrals to the same *intent* as app tokens where possible (avoid a totally different radius scale).

We are **not** expanding Tailwind to the full app until there is a dedicated migration plan.
