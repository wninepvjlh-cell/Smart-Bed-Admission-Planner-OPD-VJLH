import { Router } from 'express';

import authRouter from './auth.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRouter);

export default router;
