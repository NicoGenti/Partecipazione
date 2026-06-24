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

export interface RsvpRecord {
  deviceId: string;
  recipient: Recipient;
  fullName: string;
  adults: number;
  bringingChildren: boolean;
  childrenCount: number;
  intolerances: Intolerance[];
  intolerancesOther: string;
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
