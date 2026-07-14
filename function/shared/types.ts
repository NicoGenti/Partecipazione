/**
 * Contratto JSON condiviso con il frontend (src/dashboard/types.ts e src/rsvp.ts).
 * Qualsiasi modifica qui DEVE essere rispecchiata lato client.
 */

export type Recipient = 'nicolas' | 'giulia';

export type Intolerance =
  | 'vegetarian'
  | 'vegan'
  | 'celiac'
  | 'lactose-free'
  | 'nut-allergy'
  | 'other';

export interface GuestIntolerances {
  name: string;
  intolerances: Intolerance[];
  intolerancesOther: string;
}

export interface RsvpRecord {
  deviceId: string;
  recipient?: Recipient;
  fullName: string;
  adults: number;
  guestNames: string[];
  bringingChildren: boolean;
  childrenCount: number;
  intolerances: Intolerance[];
  intolerancesOther: string;
  /** Per-guest intolerances (new format). Falls back to top-level `intolerances` for legacy records. */
  guestIntolerances?: GuestIntolerances[];
  needsRoom: boolean;
  roomGuests: number;
  roomLocation: 'Villa Montegranelli';
  submittedAt: string;
}

export interface ConsentRecord {
  deviceId: string;
  nickname: string;
  consent: boolean;
  consentTextVersion: string;
  timestamp: string;
  device: Record<string, unknown>;
}
