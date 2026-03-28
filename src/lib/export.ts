/**
 * Download a 2D array of strings as a CSV file.
 * First row is treated as headers.
 * Includes UTF-8 BOM for Excel compatibility.
 */
export function downloadCSV(filename: string, rows: (string | number)[][]): void {
  const csv = rows
    .map((r) =>
      r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function csvDate(): string {
  return new Date().toISOString().slice(0, 10);
}
