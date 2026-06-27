const express = require('express');
const router = express.Router();
// TODO: implement review controller and routes
router.get('/', (req, res) => res.json({ success: true, message: 'review route ready' }));
module.exports = router;
