import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "La Closing Académie - VSL",
};

export default function VSLLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
