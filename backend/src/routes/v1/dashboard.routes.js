const express = require('express');
const controller = require('../../controllers/v1/dashboard.controller');
const { protect } = require('../../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.get('/summary', controller.getSummary);

module.exports = router;

