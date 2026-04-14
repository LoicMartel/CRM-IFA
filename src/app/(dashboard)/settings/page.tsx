import { Header } from "@/components/layout/header";
import { SettingsView } from "@/components/admin/settings-view";

export const metadata = { title: "Paramètres" };

export default function SettingsPage() {
  return (
    <>
      <Header title="Paramètres" />
      <div className="p-6">
        <SettingsView />
      </div>
    </>
  );
}
