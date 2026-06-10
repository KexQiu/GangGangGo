import { create } from 'zustand';

import type { AdvancedReportResponse, TeamWeeklyReportResponse } from '@xiaotidu/contracts';

import { apiClient } from '../../api/client';
import { isProStatus, toUserMessage, useAuthStore } from '../account/authStore';
import { syncRecentReportSnapshots } from '../sync/reportSnapshotSync';

type ReportState = {
  advancedReport: AdvancedReportResponse | null;
  error: null | string;
  isLoading: boolean;
  teamWeeklyReport: TeamWeeklyReportResponse | null;
  loadAdvancedReport: () => Promise<void>;
  loadTeamWeeklyReport: () => Promise<void>;
};

export const useReportStore = create<ReportState>((set) => ({
  advancedReport: null,
  error: null,
  isLoading: false,
  loadAdvancedReport: async () => {
    const { accessToken, proStatus } = useAuthStore.getState();

    if (!accessToken || !isProStatus(proStatus)) {
      set({ advancedReport: null });
      return;
    }

    set({ error: null, isLoading: true });

    try {
      await syncRecentReportSnapshots();
      const advancedReport = await apiClient.getAdvancedReport(accessToken);
      set({ advancedReport, error: null, isLoading: false });
    } catch (error) {
      set({ error: toUserMessage(error), isLoading: false });
    }
  },
  loadTeamWeeklyReport: async () => {
    const { accessToken, proStatus } = useAuthStore.getState();

    if (!accessToken || !isProStatus(proStatus)) {
      set({ teamWeeklyReport: null });
      return;
    }

    set({ error: null, isLoading: true });

    try {
      const teamWeeklyReport = await apiClient.getTeamWeeklyReport(accessToken);
      set({ error: null, isLoading: false, teamWeeklyReport });
    } catch (error) {
      set({ error: toUserMessage(error), isLoading: false });
    }
  },
  teamWeeklyReport: null,
}));
