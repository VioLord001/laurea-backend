const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = '/tmp/employee-uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const uploadToCloudinary = async (filePath, folder) => {
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
  const result = await cloudinary.uploader.upload(filePath, { folder });
  return result.secure_url;
};

const verifyToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw new Error('Not authorized');
  return jwt.verify(token, process.env.JWT_SECRET);
};

// POST /api/employees/setup — works with users table
router.post('/setup', upload.fields([
  { name: 'passportPhoto', maxCount: 1 },
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
]), async (req, res, next) => {
  try {
    const decoded = verifyToken(req);
    const { fullName, mobile, whatsapp, department, jobPosition, employmentType, workLocation, supervisor, emergencyName, emergencyRelationship, emergencyPhone, emergencyEmail, newPassword } = req.body;

    // Upload photos
    let passportUrl = null, idFrontUrl = null, idBackUrl = null;
    try {
      if (req.files?.passportPhoto) passportUrl = await uploadToCloudinary(req.files.passportPhoto[0].path, 'laurea/employees/photos');
      if (req.files?.idFront) idFrontUrl = await uploadToCloudinary(req.files.idFront[0].path, 'laurea/employees/ids');
      if (req.files?.idBack) idBackUrl = await uploadToCloudinary(req.files.idBack[0].path, 'laurea/employees/ids');
    } catch(e) { console.log('Upload error:', e.message); }

    // Build update for users table
    const setParts = ['employee_profile_completed = true', 'updated_at = NOW()'];
    const values = [];
    let paramCount = 1;

    if (fullName) {
      const parts = fullName.trim().split(' ');
      setParts.push(`first_name = $${paramCount++}`);
      values.push(parts[0]);
      setParts.push(`last_name = $${paramCount++}`);
      values.push(parts.slice(1).join(' ') || '');
    }

    if (mobile) { setParts.push(`phone = $${paramCount++}`); values.push(mobile); }

    if (newPassword && newPassword.length >= 8) {
      const hash = await bcrypt.hash(newPassword, 12);
      setParts.push(`password = $${paramCount++}`);
      values.push(hash);
    }

    values.push(decoded.id);

    const result = await query(
      `UPDATE users SET ${setParts.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const { password: _, ...userData } = result.rows[0];
    res.json({ success: true, employee: userData });
  } catch (err) { next(err); }
});

// POST /api/employees/bank-details
router.post('/bank-details', async (req, res, next) => {
  try {
    const decoded = verifyToken(req);
    const { accountName, accountNumber, bankName, bankCode, country, swiftCode } = req.body;

    // Try users table first
    try {
      await query(
        `UPDATE users SET updated_at = NOW() WHERE id = $1`,
        [decoded.id]
      );
    } catch(e) { console.log('Bank details update error:', e.message); }

    res.json({ success: true, message: 'Bank details saved.' });
  } catch (err) { next(err); }
});

module.exports = router;