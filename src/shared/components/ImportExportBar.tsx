import { useRef, useState } from 'react';
import { downloadSampleExcel, exportRowsToExcel, exportRowsToPdf, parseExcelFile } from '@/shared/lib/tableExport';
import { useToast } from '@/shared/components/ui/Toast';

export interface ImportResult {
  success: number;
  failed: number;
  /** Optional short reasons for failed rows, shown in the toast (first few only). */
  failMessages?: string[];
}

interface ImportExportBarProps {
  /** Plain-language name of what's being bulk-added, e.g. "equipment types". */
  entityLabel: string;
  sampleFilename: string;
  sampleHeaders: string[];
  sampleRows: (string | number)[][];
  onImportRows: (rows: Record<string, string>[]) => Promise<ImportResult> | ImportResult;
  exportFilenameBase: string;
  exportTitle: string;
  exportHeaders: string[];
  getExportRows: () => (string | number)[][];
}

export default function ImportExportBar({
  entityLabel,
  sampleFilename,
  sampleHeaders,
  sampleRows,
  onImportRows,
  exportFilenameBase,
  exportTitle,
  exportHeaders,
  getExportRows
}: ImportExportBarProps) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    if (!file) return;
    setBusy(true);
    try {
      const rows = await parseExcelFile(file);
      if (rows.length === 0) {
        showToast('That file has no data rows to import.');
        return;
      }
      const result = await onImportRows(rows);
      if (result.success > 0 && result.failed === 0) {
        showToast(`Imported ${result.success} ${entityLabel}.`);
      } else if (result.success > 0 && result.failed > 0) {
        showToast(`Imported ${result.success} ${entityLabel}, skipped ${result.failed} row(s) with missing/invalid data.`);
      } else {
        showToast(`Nothing imported — check the file matches the sample format.`);
      }
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setOpen(false);
    } catch (err) {
      console.error('Excel import failed:', err);
      showToast('Could not read that file — make sure it\'s a valid .xlsx file.');
    } finally {
      setBusy(false);
    }
  }

  function handleExportExcel() {
    const rows = getExportRows();
    if (rows.length === 0) {
      showToast('Nothing to export yet.');
      return;
    }
    exportRowsToExcel(`${exportFilenameBase}.xlsx`, exportTitle, exportHeaders, rows).catch((err) => {
      console.error('Excel export failed:', err);
      showToast('Could not generate the Excel file — please try again.');
    });
  }

  async function handleExportPdf() {
    const rows = getExportRows();
    if (rows.length === 0) {
      showToast('Nothing to export yet.');
      return;
    }
    showToast('Preparing PDF…');
    try {
      await exportRowsToPdf(exportTitle, exportHeaders, rows, `${exportFilenameBase}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      showToast('Could not generate the PDF — please try again.');
    }
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div className="row-actions">
        <button type="button" className="btn small secondary" onClick={() => setOpen((o) => !o)}>
          Import Excel
        </button>
        <button type="button" className="btn small secondary" onClick={handleExportExcel}>
          Export Excel
        </button>
        <button type="button" className="btn small secondary" onClick={handleExportPdf}>
          Export PDF
        </button>
      </div>

      {open && (
        <div className="panel" style={{ marginTop: 10, marginBottom: 0 }}>
          <p className="field-hint" style={{ marginBottom: 12 }}>
            Upload an Excel file (.xlsx) to add {entityLabel} in bulk. Not sure of the columns needed?
            Download the sample file below and fill it in the same format.
          </p>
          <div className="field-row" style={{ marginBottom: 12 }}>
            <div>
              <label htmlFor="import-excel-file">Excel file</label>
              <input
                ref={fileRef}
                type="file"
                id="import-excel-file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <div className="row-actions">
            <button type="button" className="btn small" disabled={!file || busy} onClick={handleImport}>
              {busy ? 'Importing…' : 'Import'}
            </button>
            <button
              type="button"
              className="btn small secondary"
              onClick={() =>
                downloadSampleExcel(sampleFilename, sampleHeaders, sampleRows).catch((err) => {
                  console.error('Sample file download failed:', err);
                  showToast('Could not generate the sample file — please try again.');
                })
              }
            >
              Download sample file
            </button>
            <button type="button" className="btn small ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
