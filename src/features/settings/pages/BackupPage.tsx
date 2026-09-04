import { useRef, useState } from 'react';
import { useAuth } from '@/shared/components/AuthGate';
import { useToast } from '@/shared/components/ui/Toast';
import { logActivity } from '@/shared/lib/activityLog';
import { loadNamespaced, saveNamespaced } from '@/shared/lib/storage';

const NAMESPACES = ['equipment-register', 'finance'] as const;

export default function BackupPage() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (session.role !== 'admin' && session.role !== 'superadmin') {
    return (
      <div className="empty">
        <div className="display">Admins only</div>
        <p>Backup and restore includes donation records, so only an admin can access it.</p>
      </div>
    );
  }

  async function handleExport() {
    setBusy(true);
    try {
      const data: Record<string, unknown> = {};
      for (const ns of NAMESPACES) {
        data[ns] = await loadNamespaced(ns, null);
      }
      const payload = { exportedAt: new Date().toISOString(), app: 'caretrack', data };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `caretrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      logActivity('Export backup', 'Downloaded a snapshot of equipment and donation data');
      showToast('Backup downloaded.');
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data : null;
      if (!data) throw new Error('Not a valid backup file.');
      if (
        !confirm(
          'This will overwrite the live equipment and donation data for everyone, on every device, with the contents of this backup. Continue?'
        )
      ) {
        setBusy(false);
        return;
      }
      for (const ns of NAMESPACES) {
        if (ns in data) await saveNamespaced(ns, data[ns as keyof typeof data]);
      }
      logActivity('Restore backup', `Restored data from a backup file (${file.name})`);
      showToast('Restore complete — reloading…');
      setTimeout(() => window.location.reload(), 900);
    } catch {
      showToast('Could not read that file — is it a CareTrack backup?');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Backup & Restore</h2>
          <p className="sub">Data lives in Supabase and is shared live across every device. Export a snapshot now and then anyway — it's your own offline copy.</p>
        </div>
      </div>

      <div className="panel">
        <h3>Export a backup</h3>
        <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 14 }}>
          Downloads a fresh snapshot straight from the live database — equipment types, active/returned loans,
          donations, and expenses — as one JSON file. (User logins aren't included; those live in Supabase Auth
          and are managed from the Users page.)
        </p>
        <button type="button" className="btn" onClick={handleExport} disabled={busy}>
          {busy ? 'Working…' : 'Download backup'}
        </button>
      </div>

      <div className="panel">
        <h3>Restore from a backup</h3>
        <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 14 }}>
          Choose a previously exported file. This overwrites the live equipment and donation data — for everyone,
          on every device — with what's in the file.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
          }}
        />
      </div>

      <div className="panel" style={{ background: 'rgba(31,111,178,0.05)' }}>
        <h3>About this data</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, lineHeight: 1.6 }}>
          Equipment and donation records live in a shared Supabase (Postgres) database now — every signed-in
          device sees the same data, live. Supabase takes its own automatic daily backups of the whole database
          (7-day retention on the free tier; longer, plus point-in-time recovery, on paid plans) — that's the
          real safety net for accidental data loss.
        </p>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, lineHeight: 1.6, marginTop: 10 }}>
          The export above is a convenient extra: a portable, human-readable copy you can keep somewhere of your
          own choosing (email it to yourself, save it to a shared drive), useful before a risky bulk change or
          just for peace of mind.
        </p>
      </div>
    </div>
  );
}
