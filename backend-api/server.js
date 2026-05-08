import express from 'express';
import authRoutes from './routes/auth.js';
import stateRoutes from './routes/state.js';
import { authMiddleware } from './middleware/auth.js';

export function createServer() {
  const app = express();
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  
  // Protected routes
  app.use('/api/state', authMiddleware, stateRoutes);

  return app;
}
