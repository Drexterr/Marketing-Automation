import express from 'express';
import { loadConnections } from './utils/helpers.js';
import path from 'path';
import logger from './utils/logger.js';

const app = express();
const port = process.env.DASHBOARD_PORT || 3000;

app.get('/api/stats', (req, res) => {
  try {
    const connections = loadConnections(path.join(process.cwd(), 'data', 'connections-sent.json'));
    
    const stats = {
      totalSent: connections.filter(c => c.status === 'sent').length,
      accepted: connections.filter(c => c.status === 'accepted' || c.stage === 'connected' || c.stage === 'replied').length,
      replied: connections.filter(c => c.stage === 'replied' || c.stage === 'conversation_active' || c.stage === 'interested').length,
      interested: connections.filter(c => c.stage === 'interested').length,
      recentActivity: connections.slice(-10).reverse()
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static dashboard files
// We'll create a simple index.html in the public folder
app.use(express.static('public'));

export function startDashboard() {
  app.listen(port, () => {
    logger.info(`Dashboard server running at http://localhost:${port}`);
  });
}
