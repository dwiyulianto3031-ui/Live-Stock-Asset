// CSV/Excel export utilities

export function toCSV(rows: Record<string, any>[], headers?: string[]): string {
  if (rows.length === 0) return "";
  const cols = headers ?? Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [cols.map(escape).join(",")];
  for (const row of rows) {
    lines.push(cols.map((c) => escape(row[c])).join(","));
  }
  return lines.join("\n");
}

export function downloadCSV(filename: string, rows: Record<string, any>[], headers?: string[]) {
  const csv = toCSV(rows, headers);
  // Tambah BOM untuk Excel agar UTF-8 terbaca dengan benar
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatDateCompact(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
