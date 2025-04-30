import express from 'express';
// @ts-ignore
import userRoutes from './user-routes.ts';
// @ts-ignore
import aiRoutes from './ai-routes.ts';

const router = express.Router();

// Mount route handlers
router.use('/users', userRoutes);
router.use('/ai-chat', aiRoutes);

export default router;
