import { RuntimeStateRepository } from '../../shared/repositories/RuntimeStateRepository.js';
import logger from '../../src/utils/logger.js';

const repo = new RuntimeStateRepository();
let lastPulseTime = 0;
const THROTTLE_MS = 2000;
let pulseTimeout = null;

const VALID_MODULES = [
    'scheduler', 'task-connect', 'task-feed', 'task-first-message', 
    'task-followups', 'task-post-content', 'task-reply-check', 'task-reply-respond'
];

const VALID_TRANSITIONS = {
  'IDLE': ['RUNNING'],
  'RUNNING': ['PAUSED', 'ERROR', 'IDLE'],
  'PAUSED': ['RUNNING', 'IDLE'],
  'ERROR': ['IDLE']
};

export const RuntimeStateService = {
    setWorkflowState: (newState) => {
        const currentState = repo.get('workflow_state') || 'IDLE';
        
        if (currentState === newState) return;
        
        if (currentState && VALID_TRANSITIONS[currentState] && !VALID_TRANSITIONS[currentState].includes(newState)) {
            if (newState !== 'ERROR') {
                throw new Error(`Invalid transition from ${currentState} to ${newState}`);
            }
        }
        
        repo.set('workflow_state', newState);
    },
    
    getWorkflowState: () => repo.get('workflow_state') || 'IDLE',

    getFlag: (key) => repo.get(key),
    setFlag: (key, value) => {
        const isValidEnabledFlag = key.endsWith('_enabled') && VALID_MODULES.includes(key.replace('_enabled', ''));
        const validKey = key === 'emergency_stop' || key === 'system_state' || key === 'runtime_pulse' || isValidEnabledFlag;
        
        if (!validKey) {
            logger.warn(`Rejected invalid runtime state key: ${key}`);
            return;
        }
        return repo.set(key, value);
    },
    shouldStop: (moduleName) => {
        const stop = repo.get('emergency_stop');
        const moduleDisabled = repo.get(`${moduleName}_enabled`) === false;
        return stop || moduleDisabled;
    },
    emergencyStop: () => repo.set('emergency_stop', true),
    getAllFlags: () => {
        const flags = {};
        repo.findAll().forEach(row => {
            flags[row.key] = JSON.parse(row.value);
        });
        return flags;
    },
    setPulse: (data) => {
        const now = Date.now();
        const isBoundary = data.progressPercent === 100 || data.progressPercent === 0;
        const currentPulse = repo.get('runtime_pulse') || {};
        const isStatusChange = data.status !== currentPulse.status;

        const writePulse = () => {
            const pulse = {
                ...data,
                lastHeartbeat: new Date().toISOString()
            };
            repo.set('runtime_pulse', pulse);
            lastPulseTime = Date.now();
        };

        if (isBoundary || isStatusChange || now - lastPulseTime > THROTTLE_MS) {
            if (pulseTimeout) clearTimeout(pulseTimeout);
            writePulse();
        } else {
            if (pulseTimeout) clearTimeout(pulseTimeout);
            pulseTimeout = setTimeout(writePulse, THROTTLE_MS);
        }
    },
    getPulse: () => {
        return repo.get('runtime_pulse') || { status: 'IDLE', activeTask: null };
    },
    getSystemHealth: () => {
        const systemState = repo.get('system_state') || {};
        const schedulerFailures = systemState.consecutiveFailures || 0;
        const claudeDegraded = systemState.degradedMode || false;
        
        let dbHealthy = true;
        try {
            repo.db.prepare('SELECT 1').get();
        } catch (e) {
            dbHealthy = false;
        }

        let status = 'HEALTHY';
        const details = {
            schedulerFailures,
            claudeDegraded,
            dbHealthy
        };

        if (!dbHealthy || schedulerFailures >= 5) {
            status = 'ERROR';
        } else if (claudeDegraded || schedulerFailures > 0) {
            status = 'DEGRADED';
        }

        return { status, details };
    }
};
