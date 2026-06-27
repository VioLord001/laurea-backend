const express = require('express');
const router = express.Router();
// TODO: implement search controller and routes
router.get('/', (req, res) => res.json({ success: true, message: 'search route ready' }));
module.exports = router;
