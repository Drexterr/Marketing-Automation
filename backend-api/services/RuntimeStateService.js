import { RuntimeStateRepository } from '../../shared/repositories/RuntimeStateRepository.js';

const repo = new RuntimeStateRepository();
let lastPulseTime = 0;
const THROTTLE_MS = 2000;
let pulseTimeout = null;

export const RuntimeStateService = {
    getFlag: (key) => repo.get(key),
    setFlag: (key, value) => repo.set(key, value),
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
    }
};
