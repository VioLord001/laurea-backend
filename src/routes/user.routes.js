const express = require('express');
const router = express.Router();
// TODO: implement user controller and routes
router.get('/', (req, res) => res.json({ success: true, message: 'user route ready' }));
module.exports = router;
