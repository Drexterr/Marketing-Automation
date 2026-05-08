import { RuntimeStateRepository } from '../../shared/repositories/RuntimeStateRepository.js';

const repo = new RuntimeStateRepository();

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
    }
};
