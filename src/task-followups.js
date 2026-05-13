import logger from './utils/logger.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';
import { ConnectionRepository } from '../shared/repositories/ConnectionRepository.js';

const connectionRepo = new ConnectionRepository();

export async function runFollowUpMarking(signal = null) {
  logger.info('Running follow-up scheduler...');
  const records = connectionRepo.findAllConnections();
  const now = new Date().getTime();
  let updatedCount = 0;

  for (const record of records) {
    if (RuntimeStateService.shouldStop('followup') || signal?.aborted) {
      logger.info('Follow-up marking interrupted by system signal');
      break;
    }
    // Only mark as eligible if they were sent a first message and haven't replied or been closed
    if (record.state === 'first_message_sent' && record.updated_at) {
      const sentTime = new Date(record.updated_at).getTime();
      const daysSinceSent = (now - sentTime) / (1000 * 60 * 60 * 24);
      
      // Default timing: 5 days for first follow-up eligibility
      if (daysSinceSent >= 5) {
        connectionRepo.upsert(record.profile_url, 'followup_eligible', {
          followUpEligibleAt: new Date().toISOString(),
          followUpCount: 0
        });
        updatedCount++;
        logger.info(`Lead marked eligible for follow-up: ${record.name || record.profile_url} (${record.profile_url})`);
      }
    }
  }

  logger.info(`Follow-up scheduler finished. Marked ${updatedCount} leads.`);
  return { recordsProcessed: updatedCount };
}
