import logger from './utils/logger.js';
import { loadConnections, updateConnectionRecord } from './utils/helpers.js';
import path from 'path';

const CONNECTIONS_SENT_FILE = path.join(process.cwd(), 'data', 'connections-sent.json');

export async function runFollowUpMarking() {
  logger.info('Running follow-up scheduler...');
  const records = loadConnections(CONNECTIONS_SENT_FILE);
  const now = new Date().getTime();
  let updatedCount = 0;

  for (const record of records) {
    // Only mark as eligible if they were sent a first message and haven't replied or been closed
    if (record.stage === 'first_message_sent' && record.timestamp) {
      const sentTime = new Date(record.timestamp).getTime();
      const daysSinceSent = (now - sentTime) / (1000 * 60 * 60 * 24);
      
      // Default timing: 5 days for first follow-up eligibility
      if (daysSinceSent >= 5) {
        await updateConnectionRecord(CONNECTIONS_SENT_FILE, record.url, {
          stage: 'followup_eligible',
          followUpEligibleAt: new Date().toISOString(),
          followUpCount: 0
        });
        updatedCount++;
        logger.info(`Lead marked eligible for follow-up: ${record.name} (${record.url})`);
      }
    }
  }

  logger.info(`Follow-up scheduler finished. Marked ${updatedCount} leads.`);
}
