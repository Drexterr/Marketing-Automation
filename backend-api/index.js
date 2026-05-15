import dotenv from 'dotenv';
dotenv.config();

import { createServer } from './server.js';
import { stateManager } from '../shared/state/StateManager.js';

const PORT = process.env.PORT || 3001;

async function start() {
  const app = createServer();
  
  // Indicate API is running
  stateManager.setState('api', 'running');
  stateManager.setState('scheduler', 'idle'); // placeholder until scheduler is integrated
  
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Backend API running on http://127.0.0.1:${PORT}`);
  });
}

start().catch(console.error);
