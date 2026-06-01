export default function Loading() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ height: 28, width: 220, background: "#eef2f7", borderRadius: 8, marginBottom: 20 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ height: 72, background: "#f5f7fa", borderRadius: 10 }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ height: 44, background: "#f5f7fa", borderRadius: 8 }} />
        ))}
      </div>
      <span style={{ position: "absolute", left: -9999 }}>Chargement…</span>
    </div>
  );
}
