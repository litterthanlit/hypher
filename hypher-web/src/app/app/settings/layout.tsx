import { redirect } from "next/navigation";
import { requireBetaAccess, ServerAuthError } from "@/lib/serverAuth";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireBetaAccess();
  } catch (error) {
    if (error instanceof ServerAuthError && error.status === 401) {
      redirect("/sign-in?redirect_url=/app/settings");
    }
    redirect("/app");
  }
  return children;
}
