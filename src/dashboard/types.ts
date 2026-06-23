/**
 * Contratto JSON condiviso con la Azure Function (function/RsvpDashboard/index.ts).
 * Le modifiche qui DEVONO essere rispecchiate lato backend.
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
  submittedAt: string;
}

export interface IntolerancesCount {
  vegetarian: number;
  vegan: number;
  celiac: number;
  'lactose-free': number;
  'nut-allergy': number;
  other: number;
}

export interface DailyBucket {
  date: string;
  count: number;
}

export interface DashboardSummary {
  total: number;
  adultsTotal: number;
  childrenTotal: number;
  guestsTotal: number;
  byRecipient: { nicolas: number; giulia: number };
  intolerances: IntolerancesCount;
  intolerancesOther: string[];
  lastSevenDays: DailyBucket[];
}

export interface DashboardReply {
  summary: DashboardSummary;
  rows: RsvpRecord[];
}

export interface DashboardError {
  error: string;
}

export const INTOLERANCE_LABELS: Record<Intolerance, string> = {
  vegetarian: 'Vegetariano',
  vegan: 'Vegano',
  celiac: 'Celiaco / intollerante al glutine',
  'lactose-free': 'Intollerante al lattosio',
  'nut-allergy': 'Allergia a frutta secca o arachidi',
  other: 'Altro',
};

export const RECIPIENT_LABELS: Record<Recipient, string> = {
  nicolas: 'Nicolas',
  giulia: 'Giulia',
};