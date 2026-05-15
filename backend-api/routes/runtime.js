import express from 'express';
import { RuntimeStateService } from '../services/RuntimeStateService.js';
import { ConnectionRepository } from '../../shared/repositories/ConnectionRepository.js';

const router = express.Router();
const connRepo = new ConnectionRepository();

router.get('/pulse', (req, res) => {
    try {
        const pulse = RuntimeStateService.getPulse();
        res.json(pulse);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pulse' });
    }
});

router.get('/counters', (req, res) => {
    try {
        const weeklyConnections = connRepo.countSentInLast7Days();
        res.json({
            weeklyConnections,
            dailyReplies: 0,
            aiFailures: 0,
            warnings: 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch counters' });
    }
});

router.post('/modules/stop', (req, res) => {
    RuntimeStateService.emergencyStop();
    RuntimeStateService.setPulse({ status: 'STOPPED', activeTask: 'Emergency Stop Triggered' });
    res.json({ success: true });
});

router.post('/modules/resume', (req, res) => {
    RuntimeStateService.setFlag('emergency_stop', false);
    RuntimeStateService.setPulse({ status: 'IDLE', activeTask: null });
    res.json({ success: true });
});

router.post('/modules/toggle/:module', (req, res) => {
    const { module } = req.params;
    const { enabled } = req.body;
    RuntimeStateService.setFlag(`${module}_enabled`, enabled);
    res.json({ success: true });
});

export default router;
