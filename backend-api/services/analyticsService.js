import { ConnectionRepository } from '../../shared/repositories/ConnectionRepository.js';
import { RuntimeStateRepository } from '../../shared/repositories/RuntimeStateRepository.js';

const connRepo = new ConnectionRepository();
const stateRepo = new RuntimeStateRepository();

export async function getAggregatedAnalytics() {
  const connections = connRepo.findAllConnections();
  const summary = stateRepo.get('dashboard_summary') || {};
  
  // Basic aggregation logic
  const funnel = {
    sent: connections.filter(c => ['request_sent', 'connected', 'sending_first_message', 'first_message_sent', 'replied', 'conversation_active', 'interested', 'followup_eligible'].includes(c.state)).length,
    accepted: connections.filter(c => ['connected', 'sending_first_message', 'first_message_sent', 'replied', 'conversation_active', 'interested', 'followup_eligible'].includes(c.state)).length,
    replied: connections.filter(c => ['replied', 'conversation_active', 'interested'].includes(c.state)).length,
    interested: connections.filter(c => c.state === 'interested').length,
  };

  return {
    ...summary,
    funnel,
    timestamp: new Date().toISOString()
  };
}
