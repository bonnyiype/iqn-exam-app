import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ExamData, ExamSettings, Stage, ExamSession, ChoiceKey, AuthStatus, LicenseInfo } from '../types';
import { DEFAULT_SETTINGS } from '../utils/sampleData';

interface ExamStore {
  // State
  stage: Stage;
  rawText: string;
  exam: ExamData | null;
  settings: ExamSettings;
  session: ExamSession | null;
  testReport: any | null;

  // QA coverage state
  qaOrder: number[] | null;
  qaCursor: number;

  // Exam sets state
  selectedSet: number;

  // Auth state
  authStatus: AuthStatus;
  license: LicenseInfo | null;
  authError: string | null;
  authLoading: boolean;
  licenseValidationPending: boolean;
  hasDismissedLicensePrompt: boolean;

  // Actions
  setStage: (stage: Stage) => void;
  setRawText: (text: string) => void;
  setExam: (exam: ExamData | null) => void;
  updateSettings: (settings: Partial<ExamSettings>) => void;
  setTestReport: (report: any) => void;
  setQACoverage: (order: number[], cursor: number) => void;
  setSelectedSet: (setNumber: number) => void;

  // Session Actions
  startSession: (examId: string) => void;
  updateAnswers: (questionId: number, answers: ChoiceKey[]) => void;
  flagQuestion: (questionId: number) => void;
  unflagQuestion: (questionId: number) => void;
  setCurrentQuestion: (index: number) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
  
  // Utilities
  resetAll: () => void;
  loadFromStorage: () => void;
  saveToStorage: () => void;

  // Auth actions
  authenticateWithLicense: (licenseKey: string) => Promise<void>;
  checkExistingSession: () => Promise<void>;
  confirmLicense: () => Promise<boolean>;
  signOut: () => Promise<void>;
  setAuthError: (message: string | null) => void;
  setLicensePromptDismissed: (dismissed: boolean) => void;
}

export const useExamStore = create<ExamStore>()(
  persist(
    (set, get) => ({
      // Initial state
      stage: 'builder',
      rawText: '',
      exam: null,
      settings: DEFAULT_SETTINGS,
      session: null,
      testReport: null,
      qaOrder: null,
      qaCursor: 0,
      selectedSet: 1,
      authStatus: 'unknown',
      license: null,
      authError: null,
      authLoading: false,
      licenseValidationPending: false,
      hasDismissedLicensePrompt: false,

      // Actions
      setStage: (stage) => set({ stage }),
      setRawText: (rawText) => set({ rawText }),
      setExam: (exam) => set({ exam }),
      updateSettings: (newSettings) => 
        set((state) => ({ settings: { ...state.settings, ...newSettings } })),
      setTestReport: (testReport) => set({ testReport }),
      setQACoverage: (order, cursor) => set({ qaOrder: order, qaCursor: cursor }),
      setSelectedSet: (selectedSet) => set({ selectedSet }),

      // Session Actions
      startSession: (examId) => set({
        session: {
          examId,
          startTime: Date.now(),
          answers: {},
          flaggedQuestions: [],
          currentQuestion: 0,
          isPaused: false,
          pausedTime: 0
        }
      }),

      updateAnswers: (questionId, answers) => set((state) => {
        if (!state.session) return state;
        return {
          session: {
            ...state.session,
            answers: {
              ...state.session.answers,
              [questionId]: answers
            }
          }
        };
      }),

      flagQuestion: (questionId) => set((state) => {
        if (!state.session) return state;
        const flagged = state.session.flaggedQuestions;
        if (!flagged.includes(questionId)) {
          return {
            session: {
              ...state.session,
              flaggedQuestions: [...flagged, questionId]
            }
          };
        }
        return state;
      }),

      unflagQuestion: (questionId) => set((state) => {
        if (!state.session) return state;
        return {
          session: {
            ...state.session,
            flaggedQuestions: state.session.flaggedQuestions.filter(id => id !== questionId)
          }
        };
      }),

      setCurrentQuestion: (index) => set((state) => {
        if (!state.session) return state;
        return {
          session: {
            ...state.session,
            currentQuestion: index
          }
        };
      }),

      pauseSession: () => set((state) => {
        if (!state.session || state.session.isPaused) return state;
        return {
          session: {
            ...state.session,
            isPaused: true,
            pausedTime: state.session.pausedTime + (Date.now() - state.session.startTime)
          }
        };
      }),

      resumeSession: () => set((state) => {
        if (!state.session || !state.session.isPaused) return state;
        return {
          session: {
            ...state.session,
            isPaused: false,
            startTime: Date.now()
          }
        };
      }),

      endSession: () => set((state) => {
        if (!state.session) return state;
        return {
          session: {
            ...state.session,
            endTime: Date.now()
          }
        };
      }),

      // Utilities
      resetAll: () => set({
        stage: 'builder',
        exam: null,
        session: null,
        testReport: null
      }),

      loadFromStorage: () => {
        // Implementation handled by persist middleware
      },

      saveToStorage: () => {
        // Implementation handled by persist middleware
      },

      authenticateWithLicense: async (licenseKey) => {
        const trimmedKey = licenseKey.trim();

        if (!trimmedKey) {
          set({
            authStatus: 'unauthenticated',
            authError: 'Enter a license key to continue.',
            license: null,
            hasDismissedLicensePrompt: false
          });
          return;
        }

        set({ authLoading: true, authError: null });

        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey: trimmedKey })
          });

          let data: any = {};
          try {
            data = await response.json();
          } catch (error) {
            data = {};
          }

          if (!response.ok) {
            if (response.status === 403 && data?.error === 'license_expired') {
              set({
                authStatus: 'expired',
                license: data?.license ?? null,
                authError: data?.message ?? 'Your license expired.',
                authLoading: false,
                hasDismissedLicensePrompt: false
              });
              return;
            }

            if (response.status === 403 && data?.error === 'license_revoked') {
              set({
                authStatus: 'unauthenticated',
                license: data?.license ?? null,
                authError: data?.message ?? 'This license has been revoked.',
                authLoading: false,
                hasDismissedLicensePrompt: false
              });
              return;
            }

            set({
              authStatus: 'unauthenticated',
              license: null,
              authError: data?.message ?? 'License could not be verified.',
              authLoading: false,
              hasDismissedLicensePrompt: false
            });
            return;
          }

          set({
            authStatus: 'authenticated',
            license: data?.license ?? null,
            authError: null,
            authLoading: false,
            hasDismissedLicensePrompt: true
          });
        } catch (error) {
          set({
            authStatus: 'unauthenticated',
            authError: 'Unable to reach licensing service. Check your connection.',
            authLoading: false,
            hasDismissedLicensePrompt: false
          });
        }
      },

      checkExistingSession: async () => {
        set({ authStatus: 'loading', authLoading: true, authError: null });

        try {
          const response = await fetch('/api/auth/session', {
            method: 'GET',
            credentials: 'include'
          });

          let data: any = {};
          try {
            data = await response.json();
          } catch (error) {
            data = {};
          }

          if (!response.ok) {
            if (response.status === 403 && data?.error === 'license_expired') {
              set({
                authStatus: 'expired',
                license: data?.license ?? null,
                authError: data?.message ?? 'Your license expired.',
                authLoading: false,
                hasDismissedLicensePrompt: false
              });
              return;
            }

            if (response.status === 403 && data?.error === 'license_revoked') {
              set({
                authStatus: 'unauthenticated',
                license: data?.license ?? null,
                authError: data?.message ?? 'This license has been revoked.',
                authLoading: false,
                hasDismissedLicensePrompt: false
              });
              return;
            }

            set({
              authStatus: 'unauthenticated',
              license: null,
              authError: null,
              authLoading: false,
              hasDismissedLicensePrompt: false
            });
            return;
          }

          set({
            authStatus: 'authenticated',
            license: data?.license ?? null,
            authError: null,
            authLoading: false,
            hasDismissedLicensePrompt: true
          });
        } catch (error) {
          set({
            authStatus: 'unauthenticated',
            authError: 'Unable to reach licensing service. Please try again.',
            authLoading: false,
            hasDismissedLicensePrompt: false
          });
        }
      },

      confirmLicense: async () => {
        set({ licenseValidationPending: true });
        await get().checkExistingSession();
        set({ licenseValidationPending: false });
        return get().authStatus === 'authenticated';
      },

      signOut: async () => {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
          });
        } catch (error) {
          // Ignore logout network errors
        }

        set({
          authStatus: 'unauthenticated',
          license: null,
          authError: null,
          authLoading: false,
          licenseValidationPending: false,
          hasDismissedLicensePrompt: false,
          stage: 'builder',
          exam: null,
          session: null,
          testReport: null,
          qaOrder: null,
          qaCursor: 0
        });
      },

      setAuthError: (message) => set({ authError: message }),

      setLicensePromptDismissed: (dismissed) => set({ hasDismissedLicensePrompt: dismissed })
    }),
    {
      name: 'iqn-exam-storage',
      partialize: (state) => ({
        rawText: state.rawText,
        settings: state.settings,
        exam: state.exam,
        session: state.session,
        qaOrder: state.qaOrder,
        qaCursor: state.qaCursor,
        selectedSet: state.selectedSet,
        hasDismissedLicensePrompt: state.hasDismissedLicensePrompt
      })
    }
  )
);
