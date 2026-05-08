import { NdjsonRepository } from '../../shared/repositories/NdjsonRepository.js';
import path from 'path';

const auditRepo = new NdjsonRepository(path.join('data', 'audit.ndjson'));

export async function logAudit(action, details) {
  try {
    await auditRepo.create({
      timestamp: new Date().toISOString(),
      action,
      details
    });
  } catch (error) {
    console.error('Failed to log audit:', error.message);
  }
}
