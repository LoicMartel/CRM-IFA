import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Tree-shake heavy packages — only bundle what's actually imported
    optimizePackageImports: [
      "recharts",
      "lucide-react",
      "date-fns",
      "@tiptap/starter-kit",
      "@tiptap/react",
      "@tiptap/extension-underline",
      "@tiptap/extension-text-style",
      "@tiptap/extension-color",
      "@tiptap/extension-highlight",
      "@tiptap/extension-text-align",
      "@tiptap/extension-link",
      "@tiptap/extension-placeholder",
      "@tiptap/extension-mention",
    ],
  },
};

export default nextConfig;
