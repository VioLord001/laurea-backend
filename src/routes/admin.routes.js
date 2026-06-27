const express = require('express');
const router = express.Router();
// TODO: implement admin controller and routes
router.get('/', (req, res) => res.json({ success: true, message: 'admin route ready' }));
module.exports = router;
