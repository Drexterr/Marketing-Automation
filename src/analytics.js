import fs from 'node:fs/promises';
import path from 'path';
import logger from './utils/logger.js';
import { ConnectionRepository } from '../shared/repositories/ConnectionRepository.js';

const connectionRepo = new ConnectionRepository();

export async function generateDashboardSummary(signal = null) {
  if (signal?.aborted) return { recordsProcessed: 0 };
  const records = connectionRepo.findAllConnections();
  
  const metrics = {
    connectionsSent: 0,
    accepted: 0,
    acceptanceRate: 0,
    firstMessagesSent: 0,
    replies: 0,
    replyRate: 0,
    highIntentReplies: 0,
    byCampaign: {},
    byKeyword: {}
  };

  const activeStates = ['connected', 'sending_first_message', 'first_message_sent', 'replied', 'conversation_active', 'interested', 'followup_eligible'];
  const sentStates = ['request_sent', ...activeStates];

  for (const r of records) {
    if (sentStates.includes(r.state)) metrics.connectionsSent++;
    
    if (activeStates.includes(r.state)) {
      metrics.accepted++;
    }
    
    if (['first_message_sent', 'replied', 'followup_eligible', 'interested'].includes(r.state)) {
      metrics.firstMessagesSent++;
    }

    if (r.state === 'replied' || r.state === 'interested') {
      metrics.replies++;
      if (r.interestLevel === 'high' || r.state === 'interested') metrics.highIntentReplies++;
    }

    // Campaign breakdown
    if (r.campaign) {
      if (!metrics.byCampaign[r.campaign]) {
        metrics.byCampaign[r.campaign] = { sent: 0, accepted: 0, replies: 0 };
      }
      if (sentStates.includes(r.state)) metrics.byCampaign[r.campaign].sent++;
      if (activeStates.includes(r.state)) metrics.byCampaign[r.campaign].accepted++;
      if (r.state === 'replied') metrics.byCampaign[r.campaign].replies++;
    }

    // Keyword breakdown
    if (r.sourceKeyword) {
      if (!metrics.byKeyword[r.sourceKeyword]) {
        metrics.byKeyword[r.sourceKeyword] = { sent: 0, accepted: 0, replies: 0 };
      }
      if (sentStates.includes(r.state)) metrics.byKeyword[r.sourceKeyword].sent++;
      if (activeStates.includes(r.state)) metrics.byKeyword[r.sourceKeyword].accepted++;
      if (r.state === 'replied') metrics.byKeyword[r.sourceKeyword].replies++;
    }
  }

  // Calculate rates
  if (metrics.connectionsSent > 0) {
    metrics.acceptanceRate = parseFloat(((metrics.accepted / metrics.connectionsSent) * 100).toFixed(1));
  }
  if (metrics.firstMessagesSent > 0) {
    metrics.replyRate = parseFloat(((metrics.replies / metrics.firstMessagesSent) * 100).toFixed(1));
  }

  const outPath = path.join(process.cwd(), 'data', 'dashboard-summary.json');
  const dir = path.dirname(outPath);
  
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(outPath, JSON.stringify({
      ...metrics,
      lastUpdated: new Date().toISOString()
    }, null, 2));
    logger.info(`Dashboard summary exported to ${outPath}`);
  } catch (error) {
    logger.error('Failed to export dashboard summary', { error: error.message });
  }

  return metrics;
}
