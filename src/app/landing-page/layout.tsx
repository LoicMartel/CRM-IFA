import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IFA Formation - Landing Page",
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
