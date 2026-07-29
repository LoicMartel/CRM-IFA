import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IFA Formatio - Landing Page",
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
