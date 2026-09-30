import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardOverview } from "@/components/dashboard-overview";

export default function DashboardPage() {
  return (
    <DashboardShell eyebrow="Centre de travail" title="Bonjour, que voulez-vous créer ?">
      <DashboardOverview />
    </DashboardShell>
  );
}
