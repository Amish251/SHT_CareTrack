import { useEffect } from 'react';

interface Props {
  url: string;
  title: string;
  onClose: () => void;
}

export default function PdfPreviewModal({ url, title, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="btn ghost small" onClick={onClose}>
            Close ✕
          </button>
        </div>
        <iframe src={url} title={title} className="modal-pdf-frame" />
      </div>
    </div>
  );
}
