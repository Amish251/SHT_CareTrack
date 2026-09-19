import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, FileText, Download, Upload, X, CheckCircle2 } from 'lucide-react';
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
  /** Optional primary "+ Add X" action rendered as part of the same toolbar,
   *  so it and Import/Export read as one coherent group instead of two
   *  separate controls sitting next to each other. */
  addAction?: { label: string; to: string };
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
  getExportRows,
  addAction
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

  function handleChooseFile() {
    fileRef.current?.click();
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div className="action-toolbar">
        {addAction && (
          <>
            <Link to={addAction.to} className="btn small">
              {addAction.label}
            </Link>
            <div className="action-toolbar-divider" />
          </>
        )}
        <div className="io-group">
          <button type="button" className={`io-btn ${open ? 'active' : ''}`} onClick={() => setOpen((o) => !o)}>
            <span className="io-icon">
              <Upload />
            </span>
            <span className="io-label">Import</span>
          </button>
          <button type="button" className="io-btn" onClick={handleExportExcel}>
            <span className="io-icon excel">
              <FileSpreadsheet />
            </span>
            <span className="io-label">Excel</span>
          </button>
          <button type="button" className="io-btn" onClick={handleExportPdf}>
            <span className="io-icon pdf">
              <FileText />
            </span>
            <span className="io-label">PDF</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="panel" style={{ marginTop: 4, marginBottom: 0 }}>
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={handleChooseFile}
            role="button"
            tabIndex={0}
          >
            <div className="dropzone-icon">
              <FileSpreadsheet />
              <span className="badge-dot">
                <Upload />
              </span>
            </div>
            <h4>{file ? file.name : 'Upload Excel file'}</h4>
            <p className="sub">
              {file
                ? 'Ready to import — check it matches the sample format, then click Import below.'
                : `Drag and drop your Excel file here, or click to browse. Adds ${entityLabel} in bulk.`}
            </p>
            <button
              type="button"
              className="btn small"
              onClick={(e) => {
                e.stopPropagation();
                handleChooseFile();
              }}
            >
              Choose file
            </button>
            <input
              ref={fileRef}
              type="file"
              id="import-excel-file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="dropzone-footer">
            <span className="dropzone-support">
              <CheckCircle2 />
              Supports .xlsx, .xls files
            </span>
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
                <Download size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Download sample file
              </button>
              <button type="button" className="btn small ghost" onClick={() => setOpen(false)}>
                <X size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
