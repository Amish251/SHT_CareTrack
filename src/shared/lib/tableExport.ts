/** Downloads an array-of-arrays as an .xlsx file — used for both real exports and sample templates. */
export async function exportRowsToExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][]
): Promise<void> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(12, h.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

/** Downloads a template file with the expected columns and a couple of example rows filled in. */
export async function downloadSampleExcel(
  filename: string,
  headers: string[],
  sampleRows: (string | number)[][]
): Promise<void> {
  await exportRowsToExcel(filename, 'Sample', headers, sampleRows);
}

/** Reads the first sheet of an uploaded Excel file into row objects keyed by (trimmed) header. */
export async function parseExcelFile(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];
  return rows.map((row) => {
    const out: Record<string, string> = {};
    Object.entries(row).forEach(([key, value]) => {
      out[key.trim()] = String(value ?? '').trim();
    });
    return out;
  });
}

/** Case/whitespace-insensitive lookup of a column value from a parsed Excel row. */
export function pickField(row: Record<string, string>, ...names: string[]): string {
  const normalized = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/\s+/g, ''), v]));
  for (const name of names) {
    const key = name.toLowerCase().replace(/\s+/g, '');
    if (normalized[key] !== undefined) return normalized[key];
  }
  return '';
}

/** Builds a landscape PDF table (title + header row + data rows) and downloads it. */
export async function exportRowsToPdf(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(14, 47, 82);
  doc.text(title, 40, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(98, 120, 141);
  doc.text(`Exported ${new Date().toLocaleDateString('en-IN')}`, 40, 50);

  autoTable(doc, {
    startY: 62,
    head: [headers],
    body: rows.map((r) => r.map(String)),
    styles: { fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: [14, 47, 82], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 249, 252] }
  });

  doc.save(filename);
}
