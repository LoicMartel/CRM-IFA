export type ExportFormat = "csv" | "xls" | "xlsx";

export async function exportData(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[],
  filename: string,
  format: ExportFormat
) {
  const XLSX = await import("xlsx");

  const data = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach(({ key, label }) => {
      obj[label] = row[key] ?? "";
    });
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");

  const ext = format === "csv" ? "csv" : format === "xls" ? "xls" : "xlsx";
  const bookType = format === "csv" ? "csv" as const : format === "xls" ? "biff8" as const : "xlsx" as const;

  XLSX.writeFile(wb, `${filename}.${ext}`, { bookType });
}
