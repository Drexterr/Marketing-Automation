import express from 'express';
import { getAggregatedAnalytics } from '../services/analyticsService.js';
import { ActivityRepository } from '../../shared/repositories/ActivityRepository.js';
import { ConnectionRepository } from '../../shared/repositories/ConnectionRepository.js';

const router = express.Router();
const activityRepo = new ActivityRepository();
const connRepo = new ConnectionRepository();

router.get('/', async (req, res) => {
  try {
    const data = await getAggregatedAnalytics();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/details', async (req, res) => {
  try {
    const { type } = req.query;

    if (type === 'connections') {
      const rows = connRepo.findAllConnections();
      const items = rows.map(r => ({
        name: r.name || r.profile_url,
        profileUrl: r.profile_url,
        state: r.state,
        date: r.updated_at,
        headline: r.headline || '',
      }));
      return res.json({ type, items });
    }

    if (type === 'comments') {
      const rows = activityRepo.getRecent(5000).filter(r => r.event_type === 'feed_comment');
      const items = rows.map(r => {
        let d = {};
        try { d = JSON.parse(r.details || '{}'); } catch {}
        return {
          postSnippet: (d.postText || d.post_text || '').slice(0, 120),
          comment: d.comment || d.text || '',
          date: r.timestamp || r.created_at,
        };
      });
      return res.json({ type, items });
    }

    if (type === 'replies') {
      const rows = activityRepo.getRecent(5000).filter(r => r.event_type === 'reply_sent');
      const items = rows.map(r => {
        let d = {};
        try { d = JSON.parse(r.details || '{}'); } catch {}
        return {
          name: d.name || d.profile || r.module || 'Unknown',
          reply: d.reply || d.text || '',
          date: r.timestamp || r.created_at,
        };
      });
      return res.json({ type, items });
    }

    if (type === 'messages') {
      const rows = activityRepo.getRecent(5000).filter(r => r.event_type === 'first_message_sent');
      const items = rows.map(r => {
        let d = {};
        try { d = JSON.parse(r.details || '{}'); } catch {}
        return {
          name: d.name || d.profile || 'Unknown',
          message: d.message || d.text || '',
          date: r.timestamp || r.created_at,
        };
      });
      return res.json({ type, items });
    }

    res.status(400).json({ error: 'Invalid type. Use: connections, comments, replies, messages' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
