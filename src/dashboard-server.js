import express from 'express';
import path from 'path';
import logger from './utils/logger.js';
import { ConnectionRepository } from '../shared/repositories/ConnectionRepository.js';

const app = express();
const port = process.env.DASHBOARD_PORT || 3000;
const connRepo = new ConnectionRepository();

app.get('/api/stats', (req, res) => {
  try {
    const connections = connRepo.findAllConnections();
    
    const stats = {
      totalSent: connections.filter(c => ['request_sent', 'connected', 'sending_first_message', 'first_message_sent', 'replied', 'conversation_active', 'interested', 'followup_eligible'].includes(c.state)).length,
      accepted: connections.filter(c => ['connected', 'sending_first_message', 'first_message_sent', 'replied', 'conversation_active', 'interested', 'followup_eligible'].includes(c.state)).length,
      replied: connections.filter(c => ['replied', 'conversation_active', 'interested'].includes(c.state)).length,
      interested: connections.filter(c => c.state === 'interested').length,
      recentActivity: connections.slice(-10).reverse()
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static dashboard files
app.use(express.static('public'));

export function startDashboard() {
  app.listen(port, '127.0.0.1', () => {
    logger.info(`Dashboard server running at http://127.0.0.1:${port}`);
  });
}
