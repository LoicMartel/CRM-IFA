import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IFA Formation - VSL",
};

export default function VSLLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
