import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from './utils/logger.js';
import { ConnectionRepository } from '../shared/repositories/ConnectionRepository.js';
import { authMiddleware } from '../backend-api/middleware/auth.js';
import authRoutes from '../backend-api/routes/auth.js';
import workflowRoutes from './routes/workflows.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';

const app = express();
const port = process.env.DASHBOARD_PORT || 3000;
const connRepo = new ConnectionRepository();

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/workflows', authMiddleware, workflowRoutes);

app.get('/api/stats', authMiddleware, (req, res) => {
  try {
    const connections = connRepo.findAllConnections();
    const pulse = RuntimeStateService.getPulse();
    
    const stats = {
      totalSent: connections.filter(c => ['request_sent', 'connected', 'sending_first_message', 'first_message_sent', 'replied', 'conversation_active', 'interested', 'followup_eligible'].includes(c.state)).length,
      accepted: connections.filter(c => ['connected', 'sending_first_message', 'first_message_sent', 'replied', 'conversation_active', 'interested', 'followup_eligible'].includes(c.state)).length,
      replied: connections.filter(c => ['replied', 'conversation_active', 'interested'].includes(c.state)).length,
      interested: connections.filter(c => c.state === 'interested').length,
      recentActivity: connections.slice(-10).reverse(),
      pulse: {
        ...pulse,
        emergencyStop: RuntimeStateService.getFlag('emergency_stop')
      }
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    scheduler: RuntimeStateService.getWorkflowState()
  });
});


export function startDashboard() {
  app.listen(port, '127.0.0.1', () => {
    logger.info(`Dashboard server running at http://127.0.0.1:${port}`);
  });
}
