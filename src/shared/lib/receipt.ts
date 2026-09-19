import { jsPDF } from 'jspdf';
import type { Allocation, EquipmentRegisterData } from '@/features/equipment-register/types';
import { fmtDate, todayStr, typeById, unitById } from '@/features/equipment-register/helpers';
import type { FinanceData, FinanceEntry } from '@/features/finance/types';
import { donationReceiptNumber, expenseReceiptNumber, categoryDisplay as financeCategoryDisplay } from '@/features/finance/helpers';
import type { AccountConfig } from '@/features/accounts/config';
import type { AccountEntry, AccountLedgerData } from '@/features/accounts/types';
import { accountDebitReceiptNumber, accountReceiptNumber, categoryDisplay } from '@/features/accounts/helpers';
import { amountInWords } from '@/shared/lib/numberWords';

const TRUST_NAME = 'Show Humanity Trust';

/** Color scheme for a receipt — lets debit/expense receipts look visually
 *  distinct (gold/maroon) from credit/donation receipts (blue) at a glance,
 *  while sharing the exact same layout code. */
interface ReceiptTheme {
  /** Trust name + section-bar label + section-bar text color. */
  primary: [number, number, number];
  /** Line under the header, and the outer border/box border. */
  accent: [number, number, number];
  /** Light fill behind the section bar and the amount box. */
  boxBg: [number, number, number];
  /** Border around the amount box. */
  boxBorder: [number, number, number];
}

const DONATION_THEME: ReceiptTheme = {
  primary: [14, 47, 82],
  accent: [31, 111, 178],
  boxBg: [245, 249, 252],
  boxBorder: [180, 190, 200]
};

/** Deep maroon + gold — deliberately far from the blue donation theme so an
 *  expense/debit receipt is identifiable as "money going out" on sight. */
const EXPENSE_THEME: ReceiptTheme = {
  primary: [111, 21, 21],
  accent: [163, 39, 39],
  boxBg: [253, 246, 227],
  boxBorder: [196, 155, 61]
};

/** Fetches /logo.png and resolves it as a base64 data URL for embedding in the PDF.
 *  Resolves to null (rather than throwing) if the logo can't be loaded, so a missing
 *  or blocked asset never stops the receipt from being generated. */
async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

class Receipt {
  doc: jsPDF;
  marginX = 40;
  rightEdge: number;
  pageWidth: number;
  pageHeight: number;
  y = 46;
  theme: ReceiptTheme;

  constructor(theme: ReceiptTheme = DONATION_THEME) {
    this.doc = new jsPDF({ unit: 'pt', format: 'a5' });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.rightEdge = this.pageWidth - this.marginX;
    this.theme = theme;
  }

  /** Outer border, logo + Trust name, title/receipt-no strip. Leaves `this.y` ready for content. */
  async drawHeader(title: string, receiptNo: string, logo: string | null) {
    const { doc, marginX, rightEdge, theme } = this;
    const outerMargin = 18;

    doc.setDrawColor(...theme.boxBorder);
    doc.setLineWidth(1);
    doc.roundedRect(outerMargin, outerMargin, this.pageWidth - outerMargin * 2, this.pageHeight - outerMargin * 2, 6, 6);

    let titleX = marginX;
    if (logo) {
      const logoSize = 42;
      try {
        doc.addImage(logo, 'PNG', marginX, this.y - 26, logoSize, logoSize);
        titleX = marginX + logoSize + 12;
      } catch {
        // Logo failed to embed (unsupported format/corrupt data) — carry on without it
        // rather than letting this break receipt generation entirely.
      }
    }

    doc.setTextColor(...theme.primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(TRUST_NAME, titleX, this.y);
    this.y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(98, 120, 141);
    doc.text('CareTrack — Equipment & Donation Records', titleX, this.y);
    doc.setTextColor(0, 0, 0);

    this.y += 20;
    doc.setDrawColor(...theme.accent);
    doc.setLineWidth(1.2);
    doc.line(marginX, this.y, rightEdge, this.y);
    this.y += 22;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, marginX, this.y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(98, 120, 141);
    doc.text(`Receipt No: ${receiptNo}`, rightEdge, this.y - 12, { align: 'right' });
    doc.text(`Date: ${fmtDate(todayStr())}`, rightEdge, this.y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    this.y += 10;

    doc.setDrawColor(217, 228, 239);
    doc.setLineWidth(0.6);
    doc.line(marginX, this.y, rightEdge, this.y);
    this.y += 26;
  }

  /** One bold-label / plain-value line, advancing `this.y`. */
  row(label: string, value: string) {
    const { doc, marginX } = this;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(label, marginX, this.y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, marginX + 150, this.y);
    this.y += 19;
  }

  /** A shaded section-header bar, e.g. above an itemized table. */
  sectionBar(leftLabel: string, rightLabel: string) {
    const { doc, marginX, rightEdge, theme } = this;
    doc.setFillColor(...theme.boxBg);
    doc.rect(marginX, this.y, rightEdge - marginX, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...theme.primary);
    doc.text(leftLabel, marginX + 8, this.y + 13.5);
    doc.text(rightLabel, rightEdge - 8, this.y + 13.5, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    this.y += 20;
  }

  signatureBlock(note: string, authorisedLabel = 'Authorised Signatory') {
    const { doc, marginX, rightEdge } = this;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(98, 120, 141);
    const lines = doc.splitTextToSize(note, rightEdge - marginX - 20);
    doc.text(lines, marginX, this.y);
    doc.setTextColor(0, 0, 0);
    this.y += lines.length * 11 + 34;

    doc.setDrawColor(160, 170, 180);
    doc.setLineWidth(0.7);
    doc.line(rightEdge - 150, this.y, rightEdge, this.y);
    this.y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`For ${TRUST_NAME} — ${authorisedLabel}`, rightEdge, this.y, { align: 'right' });
  }
}

/**
 * Builds a security-deposit receipt as a PDF blob, with the Trust's logo in the header.
 * `primary` is the specific allocation the person clicked "View"/"Share" on — its own
 * patient/contact/issue-date/received-by fields drive the header, regardless of which
 * other allocations share its `group` (multi-item visits sort the group by id, which
 * isn't necessarily the record someone's looking at — using `primary` for the header
 * instead of "group[0]" is what makes an edit to one specific record always show up on
 * that record's own receipt). `group` still drives the itemized table and total —
 * pass `[primary]` for the ordinary one-item case.
 */
export async function buildDepositReceiptPdf(
  primary: Allocation,
  group: Allocation[],
  data: EquipmentRegisterData
): Promise<Blob> {
  if (group.length === 0) throw new Error('buildDepositReceiptPdf: no allocations given');
  const isBatch = group.length > 1;
  const receiptNo = `SHT/EQ/${(primary.groupId || primary.id).slice(-6).toUpperCase()}`;

  const r = new Receipt();
  const logo = await loadLogoDataUrl();
  await r.drawHeader('Security Deposit Receipt', receiptNo, logo);
  const { doc, marginX, rightEdge } = r;

  r.row('Received from:', primary.patientName || '—');
  if (primary.patientPhone) r.row('Contact number:', primary.patientPhone);
  r.row('Issue date:', fmtDate(primary.issueDate));

  r.y += 8;
  const tableStartY = r.y;
  r.sectionBar(isBatch ? 'EQUIPMENT ISSUED (THIS VISIT)' : 'EQUIPMENT', 'AMOUNT');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  let total = 0;
  for (const a of group) {
    const type = typeById(data, a.typeId);
    const found = unitById(data, a.unitId);
    const itemLabel = `${type ? type.name : '—'}${found ? ' (' + found.unit.label + ')' : ''}`;
    doc.text(itemLabel, marginX + 8, r.y + 14);
    doc.text(`Rs. ${a.tokenAmount}`, rightEdge - 8, r.y + 14, { align: 'right' });
    total += a.tokenAmount;
    r.y += 20;
    doc.setDrawColor(232, 238, 244);
    doc.setLineWidth(0.4);
    doc.line(marginX, r.y, rightEdge, r.y);
  }
  doc.setDrawColor(180, 190, 200);
  doc.setLineWidth(0.8);
  doc.rect(marginX, tableStartY, rightEdge - marginX, r.y - tableStartY);

  r.y += 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('Total deposit:', marginX, r.y);
  doc.text(`Rs. ${total}`, rightEdge - 8, r.y, { align: 'right' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(98, 120, 141);
  doc.text(amountInWords(total), marginX, r.y + 14);
  doc.setTextColor(0, 0, 0);
  r.y += 34;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Received & allocated by:', marginX, r.y);
  doc.setFont('helvetica', 'normal');
  doc.text(primary.depositReceivedBy || '—', marginX + 150, r.y);
  r.y += 22;

  r.signatureBlock(
    'This is a refundable security deposit for the equipment on loan, not a donation or payment to the Trust. It will be returned in full when the equipment is returned in good condition.'
  );

  return doc.output('blob');
}

/**
 * Builds a donation receipt as a PDF blob — logo header, receipt number, amount
 * in figures and words, payment mode, and who received it. No tax-exemption
 * claim is printed since the Trust's registration status isn't tracked here.
 */
export async function buildDonationReceiptPdf(entry: FinanceEntry, data: FinanceData): Promise<Blob> {
  const receiptNo = donationReceiptNumber(data, entry);
  const r = new Receipt(DONATION_THEME);
  const logo = await loadLogoDataUrl();
  await r.drawHeader('Donation Receipt', receiptNo, logo);
  const { doc, marginX, rightEdge } = r;

  r.row('Received from:', entry.partyName || '—');
  if (entry.partyPhone) r.row('Contact number:', entry.partyPhone);
  r.row('Purpose:', financeCategoryDisplay(entry));
  r.row('Payment mode:', entry.paymentMode || '—');

  r.y += 6;
  const boxY = r.y;
  doc.setFillColor(...r.theme.boxBg);
  doc.rect(marginX, boxY, rightEdge - marginX, 46, 'F');
  doc.setDrawColor(...r.theme.boxBorder);
  doc.setLineWidth(0.8);
  doc.rect(marginX, boxY, rightEdge - marginX, 46);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...r.theme.primary);
  doc.text('AMOUNT RECEIVED', marginX + 10, boxY + 18);
  doc.setFontSize(15);
  doc.text(`Rs. ${entry.amount.toLocaleString('en-IN')}`, rightEdge - 10, boxY + 19, { align: 'right' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(98, 120, 141);
  doc.text(amountInWords(entry.amount), marginX + 10, boxY + 34);
  doc.setTextColor(0, 0, 0);
  r.y = boxY + 46 + 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Received by:', marginX, r.y);
  doc.setFont('helvetica', 'normal');
  doc.text(entry.receivedBy || '—', marginX + 150, r.y);
  r.y += 22;

  if (entry.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(98, 120, 141);
    const noteLines = doc.splitTextToSize(`Note: ${entry.notes}`, rightEdge - marginX);
    doc.text(noteLines, marginX, r.y);
    doc.setTextColor(0, 0, 0);
    r.y += noteLines.length * 12 + 10;
  }

  r.signatureBlock(
    `With sincere thanks for this contribution towards ${TRUST_NAME}'s work. This receipt is issued for record-keeping purposes.`
  );

  return doc.output('blob');
}

/**
 * Builds an expense receipt as a PDF blob — same layout as the donation
 * receipt, but themed in maroon/gold instead of blue so it's identifiable
 * as "money going out" at a glance, and worded for a payment rather than
 * a contribution (Paid to / Paid out by / AMOUNT PAID, no thank-you note).
 */
export async function buildExpenseReceiptPdf(entry: FinanceEntry, data: FinanceData): Promise<Blob> {
  const receiptNo = expenseReceiptNumber(data, entry);
  const r = new Receipt(EXPENSE_THEME);
  const logo = await loadLogoDataUrl();
  await r.drawHeader('Expense Receipt', receiptNo, logo);
  const { doc, marginX, rightEdge } = r;

  r.row('Paid to:', entry.partyName || '—');
  if (entry.partyPhone) r.row('Contact number:', entry.partyPhone);
  r.row('Purpose:', financeCategoryDisplay(entry));
  r.row('Payment mode:', entry.paymentMode || '—');

  r.y += 6;
  const boxY = r.y;
  doc.setFillColor(...r.theme.boxBg);
  doc.rect(marginX, boxY, rightEdge - marginX, 46, 'F');
  doc.setDrawColor(...r.theme.boxBorder);
  doc.setLineWidth(0.8);
  doc.rect(marginX, boxY, rightEdge - marginX, 46);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...r.theme.primary);
  doc.text('AMOUNT PAID', marginX + 10, boxY + 18);
  doc.setFontSize(15);
  doc.text(`Rs. ${entry.amount.toLocaleString('en-IN')}`, rightEdge - 10, boxY + 19, { align: 'right' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(98, 120, 141);
  doc.text(amountInWords(entry.amount), marginX + 10, boxY + 34);
  doc.setTextColor(0, 0, 0);
  r.y = boxY + 46 + 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Paid out by:', marginX, r.y);
  doc.setFont('helvetica', 'normal');
  doc.text(entry.receivedBy || '—', marginX + 150, r.y);
  r.y += 22;

  if (entry.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(98, 120, 141);
    const noteLines = doc.splitTextToSize(`Note: ${entry.notes}`, rightEdge - marginX);
    doc.text(noteLines, marginX, r.y);
    doc.setTextColor(0, 0, 0);
    r.y += noteLines.length * 12 + 10;
  }

  r.signatureBlock(`This is a record of an expense paid out of ${TRUST_NAME}'s funds, issued for record-keeping purposes.`);

  return doc.output('blob');
}

/**
 * Builds a credit receipt for one of the named account ledgers (Ambaji
 * Account, SEOC Account, or any future one in `ACCOUNTS`) — same visual
 * style as the donation receipt, but scoped to that account: its own
 * receipt-number series (so Ambaji and SEOC numbering never collide) and
 * the account's name printed as its own line so it's clear which book this
 * money was recorded against. Debit entries get their own themed receipt —
 * see buildAccountDebitReceiptPdf below.
 */
export async function buildAccountReceiptPdf(
  entry: AccountEntry,
  data: AccountLedgerData,
  config: AccountConfig
): Promise<Blob> {
  const receiptNo = accountReceiptNumber(data, entry, config);
  const r = new Receipt(DONATION_THEME);
  const logo = await loadLogoDataUrl();
  await r.drawHeader('Credit Receipt', receiptNo, logo);
  const { doc, marginX, rightEdge } = r;

  r.row('Account:', config.title);
  r.row('Received from:', entry.partyName || '—');
  if (entry.partyPhone) r.row('Contact number:', entry.partyPhone);
  r.row('Purpose:', categoryDisplay(entry));
  r.row('Payment mode:', entry.paymentMode || '—');

  r.y += 6;
  const boxY = r.y;
  doc.setFillColor(...r.theme.boxBg);
  doc.rect(marginX, boxY, rightEdge - marginX, 46, 'F');
  doc.setDrawColor(...r.theme.boxBorder);
  doc.setLineWidth(0.8);
  doc.rect(marginX, boxY, rightEdge - marginX, 46);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...r.theme.primary);
  doc.text('AMOUNT RECEIVED', marginX + 10, boxY + 18);
  doc.setFontSize(15);
  doc.text(`Rs. ${entry.amount.toLocaleString('en-IN')}`, rightEdge - 10, boxY + 19, { align: 'right' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(98, 120, 141);
  doc.text(amountInWords(entry.amount), marginX + 10, boxY + 34);
  doc.setTextColor(0, 0, 0);
  r.y = boxY + 46 + 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Received by:', marginX, r.y);
  doc.setFont('helvetica', 'normal');
  doc.text(entry.handledBy || '—', marginX + 150, r.y);
  r.y += 22;

  if (entry.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(98, 120, 141);
    const noteLines = doc.splitTextToSize(`Note: ${entry.notes}`, rightEdge - marginX);
    doc.text(noteLines, marginX, r.y);
    doc.setTextColor(0, 0, 0);
    r.y += noteLines.length * 12 + 10;
  }

  r.signatureBlock(
    `With sincere thanks for this contribution towards ${config.title}. This receipt is issued for record-keeping purposes.`
  );

  return doc.output('blob');
}

/**
 * Builds a debit (expense) receipt for one of the named account ledgers —
 * same layout as buildAccountReceiptPdf, but themed in maroon/gold and
 * worded for a payment rather than a contribution, same distinction as
 * buildExpenseReceiptPdf makes for the Donation module.
 */
export async function buildAccountDebitReceiptPdf(
  entry: AccountEntry,
  data: AccountLedgerData,
  config: AccountConfig
): Promise<Blob> {
  const receiptNo = accountDebitReceiptNumber(data, entry, config);
  const r = new Receipt(EXPENSE_THEME);
  const logo = await loadLogoDataUrl();
  await r.drawHeader('Expense Receipt', receiptNo, logo);
  const { doc, marginX, rightEdge } = r;

  r.row('Account:', config.title);
  r.row('Paid to:', entry.partyName || '—');
  if (entry.partyPhone) r.row('Contact number:', entry.partyPhone);
  r.row('Purpose:', categoryDisplay(entry));
  r.row('Payment mode:', entry.paymentMode || '—');

  r.y += 6;
  const boxY = r.y;
  doc.setFillColor(...r.theme.boxBg);
  doc.rect(marginX, boxY, rightEdge - marginX, 46, 'F');
  doc.setDrawColor(...r.theme.boxBorder);
  doc.setLineWidth(0.8);
  doc.rect(marginX, boxY, rightEdge - marginX, 46);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...r.theme.primary);
  doc.text('AMOUNT PAID', marginX + 10, boxY + 18);
  doc.setFontSize(15);
  doc.text(`Rs. ${entry.amount.toLocaleString('en-IN')}`, rightEdge - 10, boxY + 19, { align: 'right' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(98, 120, 141);
  doc.text(amountInWords(entry.amount), marginX + 10, boxY + 34);
  doc.setTextColor(0, 0, 0);
  r.y = boxY + 46 + 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Paid out by:', marginX, r.y);
  doc.setFont('helvetica', 'normal');
  doc.text(entry.handledBy || '—', marginX + 150, r.y);
  r.y += 22;

  if (entry.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(98, 120, 141);
    const noteLines = doc.splitTextToSize(`Note: ${entry.notes}`, rightEdge - marginX);
    doc.text(noteLines, marginX, r.y);
    doc.setTextColor(0, 0, 0);
    r.y += noteLines.length * 12 + 10;
  }

  r.signatureBlock(`This is a record of an expense paid out of ${config.title}'s funds, issued for record-keeping purposes.`);

  return doc.output('blob');
}

/** iPhone/iPad detection, including iPadOS 13+, which reports as "MacIntel" but has touch. */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isAppleTouchDevice = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isAppleTouchDevice || isIPadOS13Plus;
}

/**
 * Shares a receipt on WhatsApp with THAT RECORD'S OWN NUMBER.
 *
 * Android / desktop: always opens that specific number's chat via a
 * `wa.me/<digits>` deep link, with the PDF downloaded first so it's one tap
 * away to attach inside the now-open chat. We deliberately don't use the Web
 * Share API here even though it can attach the file directly, because the
 * OS/browser share sheet hands off to WhatsApp's own generic "choose a chat"
 * screen, not the specific contact — no website can skip that picker for a
 * named contact, since WhatsApp doesn't expose that to the web on purpose
 * (privacy). Opening the right chat every time matters more than
 * auto-attaching here, so `wa.me` wins on these platforms.
 *
 * iOS (iPhone/iPad) needs the opposite trade-off, because Safari breaks both
 * halves of that approach: blob downloads via `<a download>` are ignored —
 * Safari just opens the PDF for viewing instead of saving it — and
 * `window.open()` calls made after the async PDF-generation work are treated
 * as not user-initiated and get silently blocked by Safari's popup blocker.
 * So on iOS we use the native Web Share API instead: it reliably attaches the
 * actual PDF and lets the person pick WhatsApp from Apple's own share sheet,
 * then pick the chat themselves (same one unavoidable manual step as the
 * generic OS share sheet everywhere else).
 */
export async function shareReceiptOnWhatsApp(
  phone: string,
  blob: Blob,
  filename: string,
  message: string
): Promise<'shared' | 'downloaded'> {
  if (isIOS()) {
    const file = new File([blob], filename, { type: 'application/pdf' });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>;
    };

    if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], title: filename, text: message });
        return 'shared';
      } catch {
        // user cancelled the native share sheet — fall through to at least show the PDF
      }
    }

    // Very old iOS without Web Share file support: no reliable way to force a
    // save, so open the PDF and let the person use Safari's own share icon.
    const viewUrl = URL.createObjectURL(blob);
    window.open(viewUrl, '_blank');
    return 'downloaded';
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  const digits = phone.replace(/\D/g, '');
  const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
  return 'downloaded';
}
