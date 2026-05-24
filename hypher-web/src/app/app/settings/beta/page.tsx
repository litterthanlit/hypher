import { BetaAdminPanel } from "@/components/BetaAdminPanel";
import { requireAdmin } from "@/lib/serverAuth";

export default async function BetaSettingsPage() {
  await requireAdmin();
  return <BetaAdminPanel />;
}
