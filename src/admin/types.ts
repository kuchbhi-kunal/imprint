/** Types shared by the admin app and the public app's admin stubs. */
export type ActivationResult = {
  uid: string;
  chip: string;
  alreadyActive: boolean;
  /** Genuine NXP chip (passed NXP's originality signature). */
  nxpGenuine: boolean;
  /** Verified at activation: a write without the password was refused. Undefined if not tested. */
  writeProtected?: boolean;
};

export type LogEntry = {
  uid: string;
  chip: string;
  activatedAt: string; // ISO timestamp of first activation seen on this phone
  note?: string;
};
