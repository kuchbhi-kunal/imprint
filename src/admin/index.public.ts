/**
 * Public-app stand-ins for the admin features: the public build resolves `./src/admin` here
 * (see metro.config.js), so activation code never ships to customers. Signatures match index.ts.
 */
import type { ActivationResult, LogEntry } from './types';

export const IS_ADMIN = false;
const unavailable = (): never => {
  throw new Error('Not available in this app');
};
export const activateCard = async (): Promise<ActivationResult> => unavailable();
export const AdminGuide = (): null => null;
export const countToday = (_list: LogEntry[]): number => 0;
export const exportCsv = async (_list: LogEntry[]): Promise<void> => unavailable();
export const formatWhen = (iso: string): string => iso;
export const loadLog = async (): Promise<LogEntry[]> => [];
export const recordActivation = async (_res: ActivationResult): Promise<{ list: LogEntry[]; duplicate: boolean }> => unavailable();
export const fullKeyHex = (): string => '';
export const keyFingerprint = (): string => '';
export type { ActivationResult, LogEntry };
