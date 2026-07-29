import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IFA Formatio - Booking",
};

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
