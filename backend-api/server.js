import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import stateRoutes from './routes/state.js';
import analyticsRoutes from './routes/analytics.js';
import activityRoutes from './routes/activity.js';
import promptsRoutes from './routes/prompts.js';
import runtimeRoutes from './routes/runtime.js';
import reviewQueueRoutes from './routes/review-queue.js';
import { authMiddleware } from './middleware/auth.js';
import { securityMiddleware } from './middleware/security.js';

export function createServer() {
  const app = express();
  
  // Apply security headers, CORS, etc.
  securityMiddleware(app);
  
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRoutes);
  
  // Protected routes
  app.use('/api/state', authMiddleware, stateRoutes);
  app.use('/api/analytics', authMiddleware, analyticsRoutes);
  app.use('/api/activity', authMiddleware, activityRoutes);
  app.use('/api/prompts', authMiddleware, promptsRoutes);
  app.use('/api/runtime', authMiddleware, runtimeRoutes);
  app.use('/api/review-queue', authMiddleware, reviewQueueRoutes);

  return app;
}
