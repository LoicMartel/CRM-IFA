"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DRIVE_URL = "https://drive.google.com/drive/folders/1CGOC9B4SoDckO-_JTYhpeadUddV6qDc1";

export default function RessourcesPage() {
  const router = useRouter();

  useEffect(() => {
    window.open(DRIVE_URL, "_blank");
    router.back();
  }, [router]);

  return null;
}
