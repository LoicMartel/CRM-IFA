import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "La Closing Académie - Landing Page",
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
