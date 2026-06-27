const express = require('express');
const router = express.Router();
// TODO: implement wishlist controller and routes
router.get('/', (req, res) => res.json({ success: true, message: 'wishlist route ready' }));
module.exports = router;
