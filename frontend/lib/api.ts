import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const getSystemState = async () => {
  const { data } = await api.get('/state');
  return data;
};

export const getAnalytics = async () => {
  const { data } = await api.get('/analytics');
  return data;
};

export const getAnalyticsDetails = async (type: string) => {
  const { data } = await api.get(`/analytics/details?type=${type}`);
  return data;
};

export const getActivity = async () => {
  const { data } = await api.get('/activity');
  return data;
};

export const getPrompts = async () => {
  const { data } = await api.get('/prompts');
  return data;
};

export const updatePrompts = async (prompts: any) => {
  const { data } = await api.post('/prompts', prompts);
  return data;
};

export const getPulse = async () => {
  const { data } = await api.get('/runtime/pulse');
  return data;
};

export const getCounters = async () => {
  const { data } = await api.get('/runtime/counters');
  return data;
};

export const toggleModule = async (module: string, enabled: boolean) => {
  const { data } = await api.post(`/runtime/modules/toggle/${module}`, { enabled });
  return data;
};

export const emergencyStop = async () => {
  const { data } = await api.post('/runtime/modules/stop');
  return data;
};

export const resumeSystem = async () => {
  const { data } = await api.post('/runtime/modules/resume');
  return data;
};

export const getReviewQueue = async () => {
  const { data } = await api.get('/review-queue');
  return data;
};

export const updateReviewItem = async (id: string, status: string, response?: string) => {
  const { data } = await api.post(`/review-queue/${id}`, { status, response });
  return data;
};

export const getConfig = async (): Promise<Record<string, string>> => {
  const { data } = await api.get('/config');
  return data;
};

export const updateConfig = async (updates: Record<string, string>) => {
  const { data } = await api.post('/config', updates);
  return data;
};

export default api;
