import { LaunchReadinessPanel } from "@/components/LaunchReadinessPanel";
import { requireAdmin } from "@/lib/serverAuth";

export default async function LaunchReadinessSettingsPage() {
  await requireAdmin();
  return <LaunchReadinessPanel />;
}
