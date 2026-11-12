/**
 * Admin features (activation, activation log, key, guide). This file is used by the
 * imprint admin app only; the public app resolves `./src/admin` to `index.public.ts` instead
 * (see metro.config.js), so none of this code ships to customers.
 */
export const IS_ADMIN = true;
export { activateCard } from './activation';
export { AdminGuide } from './AdminGuide';
export { countToday, exportCsv, formatWhen, loadLog, recordActivation } from './activationLog';
export { fullKeyHex, keyFingerprint } from './key';
export type { ActivationResult, LogEntry } from './types';
