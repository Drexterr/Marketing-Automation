import express from 'express';
import authRoutes from './routes/auth.js';
import stateRoutes from './routes/state.js';
import analyticsRoutes from './routes/analytics.js';
import activityRoutes from './routes/activity.js';
import promptsRoutes from './routes/prompts.js';
import { authMiddleware } from './middleware/auth.js';

export function createServer() {
  const app = express();
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  
  // Protected routes
  app.use('/api/state', authMiddleware, stateRoutes);
  app.use('/api/analytics', authMiddleware, analyticsRoutes);
  app.use('/api/activity', authMiddleware, activityRoutes);
  app.use('/api/prompts', authMiddleware, promptsRoutes);

  return app;
}
