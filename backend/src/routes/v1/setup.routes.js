const express = require('express');
const controller = require('../../controllers/v1/setup.controller');
const { protect, requireRole } = require('../../middleware/authMiddleware');

const router = express.Router();

router.use(protect, requireRole('admin'));
router.post('/initialize', controller.initialize);
router.get('/master-data', controller.getMasterData);

module.exports = router;

