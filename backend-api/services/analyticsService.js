import { ConnectionRepository } from '../../shared/repositories/ConnectionRepository.js';
import { RuntimeStateRepository } from '../../shared/repositories/RuntimeStateRepository.js';

const connRepo = new ConnectionRepository();
const stateRepo = new RuntimeStateRepository();

export async function getAggregatedAnalytics() {
  const connections = connRepo.findAll();
  const summary = stateRepo.get('dashboard_summary') || {};
  
  // Basic aggregation logic
  const funnel = {
    sent: connections.length,
    accepted: connections.filter(c => ['accepted', 'first_message_sent', 'replied', 'interested'].includes(c.last_action)).length,
    replied: connections.filter(c => ['replied', 'interested'].includes(c.last_action)).length,
    interested: connections.filter(c => c.last_action === 'interested').length,
  };

  return {
    ...summary,
    funnel,
    timestamp: new Date().toISOString()
  };
}
