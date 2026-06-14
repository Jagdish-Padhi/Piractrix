import { create } from 'zustand';
import api from '../services/api.js';

const useAgentTraceStore = create((set) => ({
  open: false,
  decisionId: null,
  data: null,
  loading: false,
  error: null,
  openTrace: async (decisionId) => {
    set({ open: true, decisionId, loading: true, error: null, data: null });
    try {
      const response = await api.get(`/agent/decisions/${decisionId}/trace`);
      set({ data: response.data, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to load trace details', loading: false });
    }
  },
  closeTrace: () => set({ open: false, decisionId: null, data: null, error: null, loading: false }),
}));

export default useAgentTraceStore;
