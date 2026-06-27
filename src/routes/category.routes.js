const express = require('express');
const router = express.Router();
// TODO: implement category controller and routes
router.get('/', (req, res) => res.json({ success: true, message: 'category route ready' }));
module.exports = router;
