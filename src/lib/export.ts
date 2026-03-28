import * as XLSX from "xlsx";

export type ExportFormat = "csv" | "xls" | "xlsx";

export function exportData(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[],
  filename: string,
  format: ExportFormat
) {
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
  const bookType: XLSX.BookType = format === "csv" ? "csv" : format === "xls" ? "biff8" : "xlsx";

  XLSX.writeFile(wb, `${filename}.${ext}`, { bookType });
}
