import { NdjsonRepository } from '../../shared/repositories/NdjsonRepository.js';
import { ActivityRepository } from '../../shared/repositories/ActivityRepository.js';
import path from 'path';

const auditRepo = new NdjsonRepository(path.join('data', 'audit.ndjson'));
const activityRepo = new ActivityRepository();

export async function logAudit(action, details) {
  try {
    // Log to NDJSON for archival/external analysis
    await auditRepo.create({
      timestamp: new Date().toISOString(),
      action,
      details
    });

    // Log to SQLite for internal monitoring and dashboard
    activityRepo.log(action, 'audit', details);
  } catch (error) {
    console.error('Failed to log audit:', error.message);
  }
}
