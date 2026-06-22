import { genUUID } from './azure';
import { getStoredConsent } from './PrivacyModal';

const RSVP_DEVICE_KEY = 'partecipazione_device_id';

export function getOrCreateDeviceId(): string {
  const consent = getStoredConsent();
  if (consent?.deviceId) return consent.deviceId;

  let id = '';
  try {
    id = localStorage.getItem(RSVP_DEVICE_KEY) ?? '';
  } catch {
    /* localStorage may be unavailable */ }
  if (id) return id;

  id = genUUID();
  try {
    localStorage.setItem(RSVP_DEVICE_KEY, id);
  } catch {
    /* best-effort persistence */ }
  return id;
}
