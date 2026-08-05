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

// POST /api/employees/setup
router.post('/setup', upload.fields([
  { name: 'passportPhoto', maxCount: 1 },
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
]), async (req, res, next) => {
  try {
    const decoded = verifyToken(req);
    const {
      fullName, mobile, whatsapp, nationality, countryOfResidence,
      state, city, address, postalCode, docType, docNumber, docExpiry,
      department, jobPosition, employmentType, workLocation, supervisor,
      emergencyName, emergencyRelationship, emergencyPhone, emergencyEmail,
      newPassword
    } = req.body;

    // Upload photos to Cloudinary
    let passportUrl = null, idFrontUrl = null, idBackUrl = null;
    try {
      if (req.files?.passportPhoto) passportUrl = await uploadToCloudinary(req.files.passportPhoto[0].path, 'laurea/employees/photos');
      if (req.files?.idFront) idFrontUrl = await uploadToCloudinary(req.files.idFront[0].path, 'laurea/employees/ids');
      if (req.files?.idBack) idBackUrl = await uploadToCloudinary(req.files.idBack[0].path, 'laurea/employees/ids');
    } catch(e) { console.log('Upload error:', e.message); }

    // Build update for users table
    const setParts = ['employee_profile_completed = true', 'is_approved = false', 'updated_at = NOW()'];
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
    if (whatsapp) { setParts.push(`whatsapp = $${paramCount++}`); values.push(whatsapp); }
    if (nationality) { setParts.push(`nationality = $${paramCount++}`); values.push(nationality); }
    if (countryOfResidence) { setParts.push(`country_of_residence = $${paramCount++}`); values.push(countryOfResidence); }
    if (state) { setParts.push(`state = $${paramCount++}`); values.push(state); }
    if (city) { setParts.push(`city = $${paramCount++}`); values.push(city); }
    if (address) { setParts.push(`address = $${paramCount++}`); values.push(address); }
    if (postalCode) { setParts.push(`postal_code = $${paramCount++}`); values.push(postalCode); }
    if (docType) { setParts.push(`doc_type = $${paramCount++}`); values.push(docType); }
    if (docNumber) { setParts.push(`doc_number = $${paramCount++}`); values.push(docNumber); }
    if (jobPosition) { setParts.push(`job_position = $${paramCount++}`); values.push(jobPosition); }
    if (department) { setParts.push(`department = $${paramCount++}`); values.push(department); }
    if (employmentType) { setParts.push(`employment_type = $${paramCount++}`); values.push(employmentType); }
    if (workLocation) { setParts.push(`work_location = $${paramCount++}`); values.push(workLocation); }
    if (supervisor) { setParts.push(`supervisor = $${paramCount++}`); values.push(supervisor); }
    if (emergencyName) { setParts.push(`emergency_name = $${paramCount++}`); values.push(emergencyName); }
    if (emergencyRelationship) { setParts.push(`emergency_relationship = $${paramCount++}`); values.push(emergencyRelationship); }
    if (emergencyPhone) { setParts.push(`emergency_phone = $${paramCount++}`); values.push(emergencyPhone); }
    if (emergencyEmail) { setParts.push(`emergency_email = $${paramCount++}`); values.push(emergencyEmail); }
    if (passportUrl) { setParts.push(`passport_photo_url = $${paramCount++}`); values.push(passportUrl); }
    if (idFrontUrl) { setParts.push(`id_front_url = $${paramCount++}`); values.push(idFrontUrl); }
    if (idBackUrl) { setParts.push(`id_back_url = $${paramCount++}`); values.push(idBackUrl); }

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
    const { accountName, accountNumber, bankName, bankCode, country, swiftCode, pix, cpf } = req.body;
    try {
      await query(`UPDATE users SET updated_at = NOW() WHERE id = $1`, [decoded.id]);
    } catch(e) { console.log('Bank details update error:', e.message); }
    res.json({ success: true, message: 'Bank details saved.' });
  } catch (err) { next(err); }
});

module.exports = router;