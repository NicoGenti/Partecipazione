export type Recipient = 'nicolas' | 'giulia';

export type Intolerance =
  | 'vegetarian'
  | 'vegan'
  | 'celiac'
  | 'lactose-free'
  | 'nut-allergy'
  | 'other';

export interface RsvpRecord {
  deviceId: string;
  recipient: Recipient;
  fullName: string;
  adults: number;
  guestNames: string[];
  bringingChildren: boolean;
  childrenCount: number;
  intolerances: Intolerance[];
  intolerancesOther: string;
  needsRoom: boolean;
  roomGuests: number;
  roomLocation: 'Villa Montegranelli';
  submittedAt: string;
}

export const RSVP_RECIPIENTS = {
  nicolas: { label: 'Nicolas', phone: '393319581921', display: '331 958 1921' },
  giulia: { label: 'Giulia', phone: '393662041886', display: '366 204 1886' },
} as const;

export const RSVP_TEMPLATE_TEXT =
  'Ciao! Siamo felici di confermare la nostra presenza al vostro matrimonio.';

export function buildWhatsAppUrl(recipient: Recipient): string {
  return `https://wa.me/${RSVP_RECIPIENTS[recipient].phone}?text=${encodeURIComponent(
    RSVP_TEMPLATE_TEXT,
  )}`;
}

export const INTOLERANCE_OPTIONS: { value: Intolerance; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetariano' },
  { value: 'vegan', label: 'Vegano' },
  { value: 'celiac', label: 'Celiaco / intollerante al glutine' },
  { value: 'lactose-free', label: 'Intollerante al lattosio' },
  { value: 'nut-allergy', label: 'Allergia a frutta secca o arachidi' },
  { value: 'other', label: 'Altro (specifica sotto)' },
];

export function validateRsvp(
  d: Omit<
    RsvpRecord,
    'deviceId' | 'submittedAt'
  >,
): Partial<Record<keyof RsvpRecord, string>> {
  const e: Partial<Record<keyof RsvpRecord, string>> = {};

  if (!d.fullName.trim()) {
    e.fullName = 'Inserisci il tuo nome e cognome';
  } else if (d.fullName.trim().length > 80) {
    e.fullName = 'Massimo 80 caratteri';
  }

  const adults = Number(d.adults);
  if (!Number.isInteger(adults) || adults < 1 || adults > 10) {
    e.adults = 'Da 1 a 10 adulti';
  }

  if (Array.isArray(d.guestNames)) {
    const required = Math.max(0, adults - 1);
    for (let i = 0; i < required; i++) {
      if (!d.guestNames[i]?.trim()) {
        e.guestNames = 'Inserisci nome e cognome di tutti gli accompagnatori';
        break;
      }
    }
  }

  if (d.bringingChildren) {
    const c = Number(d.childrenCount);
    if (!Number.isInteger(c) || c < 1 || c > 20) {
      e.childrenCount = 'Da 1 a 20 bambini';
    }
  }

  if (d.intolerances.includes('other')) {
    if (!d.intolerancesOther.trim()) {
      e.intolerancesOther = 'Specifica l\'intolleranza o la preferenza';
    } else if (d.intolerancesOther.length > 120) {
      e.intolerancesOther = 'Massimo 120 caratteri';
    }
  }

  return e;
}

if (import.meta.env.DEV) {
  const expected =
    'https://wa.me/393319581921?text=Ciao!%20Siamo%20felici%20di%20confermare%20la%20nostra%20presenza%20al%20vostro%20matrimonio.';
  if (buildWhatsAppUrl('nicolas') !== expected) {
    // eslint-disable-next-line no-console
    console.error(
      'RSVP WhatsApp URL drift detected:',
      buildWhatsAppUrl('nicolas'),
    );
  }
}
