import { JsonRepository } from '../../shared/repositories/JsonRepository.js';
import { NdjsonRepository } from '../../shared/repositories/NdjsonRepository.js';
import path from 'path';

export async function getAggregatedAnalytics() {
  const connRepo = new NdjsonRepository(path.join('data', 'connections-sent.json'));
  const summaryRepo = new JsonRepository(path.join('data', 'dashboard-summary.json'));
  
  const connections = await connRepo.findAll();
  const summary = await summaryRepo.findAll();
  
  // Basic aggregation logic
  const funnel = {
    sent: connections.length,
    accepted: connections.filter(c => ['accepted', 'first_message_sent', 'replied', 'interested'].includes(c.stage)).length,
    replied: connections.filter(c => ['replied', 'interested'].includes(c.stage)).length,
    interested: connections.filter(c => c.stage === 'interested').length,
  };

  return {
    ...summary,
    funnel,
    timestamp: new Date().toISOString()
  };
}
