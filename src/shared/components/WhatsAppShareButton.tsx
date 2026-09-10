import { useState } from 'react';

/** Official-style WhatsApp glyph, drawn with currentColor so it follows the button's text color. */
function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M16.004 3C9.007 3 3.335 8.664 3.335 15.652c0 2.418.678 4.68 1.855 6.607L3 29l6.9-2.148a12.63 12.63 0 0 0 6.104 1.556h.005c6.996 0 12.668-5.664 12.668-12.652C28.677 8.769 23.005 3 16.004 3zm0 23.17h-.004a10.49 10.49 0 0 1-5.35-1.466l-.384-.228-3.976 1.238 1.062-3.874-.25-.398a10.46 10.46 0 0 1-1.606-5.6c0-5.791 4.72-10.502 10.512-10.502 2.808 0 5.446 1.094 7.432 3.08a10.44 10.44 0 0 1 3.08 7.432c0 5.792-4.72 10.318-10.516 10.318z" />
      <path d="M21.61 18.29c-.307-.154-1.816-.896-2.098-.998-.281-.103-.486-.154-.69.153-.205.307-.793.998-.972 1.203-.179.205-.358.23-.665.077-.307-.154-1.296-.478-2.469-1.524-.912-.813-1.528-1.818-1.707-2.125-.179-.307-.019-.473.135-.626.138-.138.307-.358.46-.537.154-.18.205-.307.307-.512.103-.205.052-.384-.026-.537-.077-.154-.69-1.665-.945-2.28-.249-.598-.502-.517-.69-.527-.179-.008-.383-.01-.588-.01s-.537.077-.818.384c-.282.307-1.075 1.05-1.075 2.561s1.1 2.97 1.253 3.176c.154.205 2.166 3.307 5.248 4.638.733.316 1.305.505 1.751.646.735.234 1.405.201 1.934.122.59-.088 1.816-.743 2.072-1.461.256-.717.256-1.332.179-1.461-.077-.128-.281-.205-.588-.358z" />
    </svg>
  );
}

interface WhatsAppShareButtonProps {
  /** Raw phone number as stored on the record. Button is disabled if this is missing/too short. */
  phone: string | undefined | null;
  /** Performs the actual receipt build + share. Errors thrown here should already be caught/toasted by the caller. */
  onShare: () => Promise<void> | void;
  label?: string;
  className?: string;
}

/**
 * A dedicated, WhatsApp-branded "Share on WhatsApp" button, distinct from the plain
 * "View" action. Disabled (with an explanatory title) when the record has no usable
 * phone number, since there'd be no chat to open. `onShare` owns building the PDF and
 * calling shareReceiptOnWhatsApp — this component only owns the busy state + styling.
 */
export default function WhatsAppShareButton({
  phone,
  onShare,
  label = 'Share on WhatsApp',
  className = ''
}: WhatsAppShareButtonProps) {
  const [busy, setBusy] = useState(false);
  const hasPhone = !!(phone && phone.replace(/\D/g, '').length >= 8);

  async function handleClick() {
    if (busy || !hasPhone) return;
    setBusy(true);
    try {
      await onShare();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`btn small whatsapp ${className}`.trim()}
      onClick={handleClick}
      disabled={!hasPhone || busy}
      title={hasPhone ? 'Share this receipt on WhatsApp' : 'No phone number on this record'}
    >
      <WhatsAppIcon />
      {busy ? 'Preparing…' : label}
    </button>
  );
}
