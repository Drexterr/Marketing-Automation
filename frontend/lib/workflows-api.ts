import axios from 'axios';

export type WorkflowStatus = {
  name: string;
  status: 'IDLE' | 'RUNNING' | 'ERROR';
  lastRunTime: string;
};

export const fetchWorkflowsStatus = async (): Promise<WorkflowStatus[]> => {
  const res = await axios.get('/api/workflows/status');
  return res.data.workflows;
};

export const startWorkflow = async (name: string) => {
  const res = await axios.post(`/api/workflows/${name}/start`);
  return res.data;
};

export const stopWorkflow = async (name: string) => {
  const res = await axios.post(`/api/workflows/${name}/stop`);
  return res.data;
};
