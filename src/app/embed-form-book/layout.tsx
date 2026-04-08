export default function EmbedFormBookLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, padding: 0, background: "transparent" }}>
        {children}
      </body>
    </html>
  );
}
