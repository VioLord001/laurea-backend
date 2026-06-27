const express = require('express');
const router = express.Router();
// TODO: implement promo controller and routes
router.get('/', (req, res) => res.json({ success: true, message: 'promo route ready' }));
module.exports = router;
