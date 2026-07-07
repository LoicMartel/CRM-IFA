import { Header } from "@/components/layout/header";
import { VisioformationTestView } from "@/components/visioformation/test-send-view";

export const metadata = { title: "Test VisioFormation" };

export default function VisioformationTestPage() {
  // Option B : URL de Joseph pré-remplie via env var (modifiable). Vide → saisie manuelle.
  const defaultUrl = process.env.VF_TEST_DEFAULT_URL ?? "";
  return (
    <>
      <Header title="Test VisioFormation" />
      <div className="p-6">
        <VisioformationTestView defaultUrl={defaultUrl} />
      </div>
    </>
  );
}
