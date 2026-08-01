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

// Create employees table
const initTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id VARCHAR(50) UNIQUE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(200),
        preferred_name VARCHAR(100),
        gender VARCHAR(50),
        dob DATE,
        nationality VARCHAR(100),
        country_of_residence VARCHAR(100),
        state VARCHAR(100),
        city VARCHAR(100),
        address TEXT,
        postal_code VARCHAR(20),
        passport_photo TEXT,
        doc_type VARCHAR(50),
        doc_number VARCHAR(100),
        doc_expiry DATE,
        id_front_url TEXT,
        id_back_url TEXT,
        mobile VARCHAR(50),
        whatsapp VARCHAR(50),
        department VARCHAR(100),
        job_position VARCHAR(100),
        employment_type VARCHAR(50),
        work_location VARCHAR(100),
        supervisor VARCHAR(100),
        emergency_name VARCHAR(200),
        emergency_relationship VARCHAR(50),
        emergency_phone VARCHAR(50),
        emergency_email VARCHAR(255),
        bank_account_name VARCHAR(200),
        bank_account_number VARCHAR(100),
        bank_name VARCHAR(200),
        bank_code VARCHAR(50),
        bank_country VARCHAR(100),
        swift_code VARCHAR(50),
        profile_completed BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch(e) { console.log('Employee table error:', e.message); }
};
initTable();

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

// POST /api/employees/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await query('SELECT * FROM employees WHERE email = $1 AND is_active = true', [email]);
    if (result.rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    const employee = result.rows[0];
    const match = await bcrypt.compare(password, employee.password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    const token = jwt.sign({ id: employee.id, type: 'employee' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...employeeData } = employee;
    res.json({ success: true, token, employee: employeeData });
  } catch (err) { next(err); }
});

// POST /api/employees/setup
router.post('/setup', upload.fields([
  { name: 'passportPhoto', maxCount: 1 },
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
]), async (req, res, next) => {
  try {
    const decoded = verifyToken(req);
    const { fullName, preferredName, gender, dob, nationality, countryOfResidence, state, city, address, postalCode, docType, docNumber, docExpiry, mobile, whatsapp, department, jobPosition, employmentType, workLocation, supervisor, emergencyName, emergencyRelationship, emergencyPhone, emergencyEmail, newPassword } = req.body;

    let passportUrl = null, idFrontUrl = null, idBackUrl = null;
    try {
      if (req.files?.passportPhoto) passportUrl = await uploadToCloudinary(req.files.passportPhoto[0].path, 'laurea/employees/photos');
      if (req.files?.idFront) idFrontUrl = await uploadToCloudinary(req.files.idFront[0].path, 'laurea/employees/ids');
      if (req.files?.idBack) idBackUrl = await uploadToCloudinary(req.files.idBack[0].path, 'laurea/employees/ids');
    } catch(e) { console.log('Upload error:', e.message); }

    const updates = {
      full_name: fullName, preferred_name: preferredName, gender, dob: dob || null,
      nationality, country_of_residence: countryOfResidence, state, city, address, postal_code: postalCode,
      passport_photo: passportUrl, doc_type: docType, doc_number: docNumber,
      doc_expiry: docExpiry || null, id_front_url: idFrontUrl, id_back_url: idBackUrl,
      mobile, whatsapp, department, job_position: jobPosition,
      employment_type: employmentType, work_location: workLocation, supervisor,
      emergency_name: emergencyName, emergency_relationship: emergencyRelationship,
      emergency_phone: emergencyPhone, emergency_email: emergencyEmail,
      profile_completed: true,
    };

    if (newPassword && newPassword.length >= 8) {
      updates.password = await bcrypt.hash(newPassword, 12);
    }

    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');

    const result = await query(
      `UPDATE employees SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, decoded.id]
    );

    const { password: _, ...employeeData } = result.rows[0];
    res.json({ success: true, employee: employeeData });
  } catch (err) { next(err); }
});

// POST /api/employees/bank-details
router.post('/bank-details', async (req, res, next) => {
  try {
    const decoded = verifyToken(req);
    const { accountName, accountNumber, bankName, bankCode, country, swiftCode } = req.body;
    await query(
      `UPDATE employees SET bank_account_name=$1, bank_account_number=$2, bank_name=$3, bank_code=$4, bank_country=$5, swift_code=$6, updated_at=NOW() WHERE id=$7`,
      [accountName, accountNumber, bankName, bankCode, country, swiftCode, decoded.id]
    );
    res.json({ success: true, message: 'Bank details saved.' });
  } catch (err) { next(err); }
});

module.exports = router;