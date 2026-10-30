import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { getGuidance, GuidanceServiceError, guidanceSchema } from './ai.js';

export function createGuidanceRouter({ config, fetchImpl, limit = 10, windowMs = 60 * 1000 }) {
  const router = express.Router();
  const limiter = rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: 'Too many guidance requests. Please wait a minute and try again.' }),
  });
  router.use(express.json({ limit: '8kb' }));
  router.post('/', limiter, async (req, res) => {
    const parsed = guidanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Please check the submitted information.',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    try {
      const guidance = await getGuidance(parsed.data, config, fetchImpl);
      res.json(guidance);
    } catch (error) {
      if (error instanceof GuidanceServiceError) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Career guidance request failed.', error);
      return res.status(502).json({ error: 'The guidance service could not complete your request. Please try again.' });
    }
  });
  router.use((error, _req, res, next) => {
    if (error.status === 413) return res.status(413).json({ error: 'This guidance request is too large. Shorten it and try again.' });
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ error: 'Please send a valid JSON request.' });
    }
    return next(error);
  });
  return router;
}
