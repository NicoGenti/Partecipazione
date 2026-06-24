import type { Intolerance, RsvpRecord } from './types';
import {
  INTOLERANCE_LABELS as LABELS,
  RECIPIENT_LABELS as RECIP_LABELS,
} from './types';

/**
 * Esporta un array di RsvpRecord in CSV UTF-8 con BOM.
 * - Separatore: ';' (compatibile con Excel italiano).
 * - A capo: CRLF (compatibile con Excel).
 * - Campi contenenti ; " o a capo vengono racchiusi tra doppi apici,
 *   con raddoppio dei doppi apici interni (RFC 4180).
 */
export function buildRsvpCsv(rows: RsvpRecord[]): string {
  const headers: string[] = [
    'Nome e cognome',
    'Referente',
    'Adulti',
    'Bambini',
    'Intolleranze',
    'Dettaglio intolleranze',
    'Inviato il',
  ];

  const lines: string[] = [headers.join(';')];

  for (const r of rows) {
    const intolerancesText = (r.intolerances ?? [])
      .map((it: Intolerance) => LABELS[it] ?? String(it))
      .join(', ');

    const submitted = formatDateItalian(r.submittedAt);

    const fields = [
      r.fullName ?? '',
      RECIP_LABELS[r.recipient] ?? r.recipient,
      String(r.adults ?? 0),
      String(r.bringingChildren ? r.childrenCount ?? 0 : 0),
      intolerancesText,
      r.intolerancesOther ?? '',
      submitted,
    ];

    lines.push(fields.map(escapeCsvField).join(';'));
  }

  const body = lines.join('\r\n');
  // BOM UTF-8 → Excel legge correttamente gli accenti.
  return '\uFEFF' + body;
}

function escapeCsvField(value: string): string {
  let v = value;
  // Previene formula injection in Excel/LibreOffice prefissando caratteri attivatori.
  if (/^[=+\-@]/.test(v)) {
    v = `'${v}`;
  }
  if (/[";\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function formatDateItalian(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch {
    return iso;
  }
}

/**
 * Avvia il download del CSV nel browser.
 */
export function downloadCsv(rows: RsvpRecord[]): void {
  const csv = buildRsvpCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rsvp-partecipazione-${new Date().toISOString().slice(0, 10)}.csv`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Libera la memoria al prossimo tick per non interrompere il download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}