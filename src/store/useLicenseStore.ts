import { create } from 'zustand';
import type { LicenseInfo } from '../types';

type LicenseStatus = LicenseInfo['status'] | 'unknown';

interface LicenseStoreState {
  info: LicenseInfo | null;
  status: LicenseStatus;
  message: string | null;
  lastUpdatedAt: string | null;
  seatId: string | null;
  setFromServer: (info: LicenseInfo | null, message?: string | null) => void;
  setSeatId: (seatId: string) => void;
  markError: (message: string) => void;
  clear: () => void;
}

export const useLicenseStore = create<LicenseStoreState>((set) => ({
  info: null,
  status: 'unknown',
  message: null,
  lastUpdatedAt: null,
  seatId: null,
  setFromServer: (info, message) => {
    set({
      info,
      status: info ? info.status : 'unknown',
      message: message ?? info?.renewalMessage ?? null,
      lastUpdatedAt: new Date().toISOString()
    });
  },
  setSeatId: (seatId) => set({ seatId }),
  markError: (message) => {
    set({
      info: null,
      status: 'unknown',
      message,
      lastUpdatedAt: new Date().toISOString()
    });
  },
  clear: () => set({ info: null, status: 'unknown', message: null, lastUpdatedAt: null })
}));
