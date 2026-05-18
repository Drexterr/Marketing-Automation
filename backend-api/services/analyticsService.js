import { ConnectionRepository } from '../../shared/repositories/ConnectionRepository.js';
import { RuntimeStateRepository } from '../../shared/repositories/RuntimeStateRepository.js';
import { ActivityRepository } from '../../shared/repositories/ActivityRepository.js';

const connRepo = new ConnectionRepository();
const stateRepo = new RuntimeStateRepository();
const activityRepo = new ActivityRepository();

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

  const allActivity = activityRepo.getRecent(5000);
  const comments = allActivity.filter(r => r.event_type === 'feed_comment').length;
  const repliesSent = allActivity.filter(r => r.event_type === 'reply_sent').length;
  const firstMessages = allActivity.filter(r => r.event_type === 'first_message_sent').length;

  return {
    ...summary,
    funnel,
    comments,
    repliesSent,
    firstMessages,
    timestamp: new Date().toISOString()
  };
}
