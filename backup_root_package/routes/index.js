const express = require('express');
const userRoutes = require('./user-routes');
const aiRoutes = require('./ai-routes');

const router = express.Router();

// Mount route handlers
router.use('/users', userRoutes);
router.use('/ai-chat', aiRoutes);

module.exports = router;