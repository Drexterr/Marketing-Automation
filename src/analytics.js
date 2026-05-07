import fs from 'node:fs/promises';
import path from 'path';
import logger from './utils/logger.js';
import { loadConnections } from './utils/helpers.js';

export async function generateDashboardSummary() {
  const filePath = path.join(process.cwd(), 'data', 'connections-sent.json');
  const records = loadConnections(filePath);
  
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

  const activeStages = ['connected', 'first_message_sent', 'replied', 'followup_eligible', 'interested'];

  for (const r of records) {
    if (r.status === 'sent') metrics.connectionsSent++;
    
    if (activeStages.includes(r.stage)) {
      metrics.accepted++;
    }
    
    if (['first_message_sent', 'replied', 'followup_eligible', 'interested'].includes(r.stage)) {
      metrics.firstMessagesSent++;
    }

    if (r.stage === 'replied' || r.stage === 'interested') {
      metrics.replies++;
      if (r.interestLevel === 'high' || r.stage === 'interested') metrics.highIntentReplies++;
    }

    // Campaign breakdown
    if (r.campaign) {
      if (!metrics.byCampaign[r.campaign]) {
        metrics.byCampaign[r.campaign] = { sent: 0, accepted: 0, replies: 0 };
      }
      if (r.status === 'sent') metrics.byCampaign[r.campaign].sent++;
      if (activeStages.includes(r.stage)) metrics.byCampaign[r.campaign].accepted++;
      if (r.stage === 'replied') metrics.byCampaign[r.campaign].replies++;
    }

    // Keyword breakdown
    if (r.sourceKeyword) {
      if (!metrics.byKeyword[r.sourceKeyword]) {
        metrics.byKeyword[r.sourceKeyword] = { sent: 0, accepted: 0, replies: 0 };
      }
      if (r.status === 'sent') metrics.byKeyword[r.sourceKeyword].sent++;
      if (activeStages.includes(r.stage)) metrics.byKeyword[r.sourceKeyword].accepted++;
      if (r.stage === 'replied') metrics.byKeyword[r.sourceKeyword].replies++;
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
