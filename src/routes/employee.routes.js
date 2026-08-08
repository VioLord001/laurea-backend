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

    let passportUrl = null, idFrontUrl = null, idBackUrl = null;
    try {
      if (req.files?.passportPhoto) passportUrl = await uploadToCloudinary(req.files.passportPhoto[0].path, 'laurea/employees/photos');
      if (req.files?.idFront) idFrontUrl = await uploadToCloudinary(req.files.idFront[0].path, 'laurea/employees/ids');
      if (req.files?.idBack) idBackUrl = await uploadToCloudinary(req.files.idBack[0].path, 'laurea/employees/ids');
    } catch(e) { console.log('Upload error:', e.message); }

    const setParts = ['employee_profile_completed = true', 'is_approved = false', 'updated_at = NOW()'];
    const values = [];
    let paramCount = 1;

    if (fullName) {
      const parts = fullName.trim().split(' ');
      setParts.push(`first_name = $${paramCount++}`); values.push(parts[0]);
      setParts.push(`last_name = $${paramCount++}`); values.push(parts.slice(1).join(' ') || '');
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
      setParts.push(`password = $${paramCount++}`); values.push(hash);
    }

    values.push(decoded.id);
    const result = await query(
      `UPDATE users SET ${setParts.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    const { password: _, ...userData } = result.rows[0];
    res.json({ success: true, employee: userData });
  } catch (err) { next(err); }
});

// POST /api/employees/bank-details
router.post('/bank-details', async (req, res, next) => {
  try {
    const decoded = verifyToken(req);
    const {
      bank1_holder, bank1_name, bank1_agency, bank1_account, bank1_pix, bank1_cpf,
      bank2_holder, bank2_name, bank2_agency, bank2_account, bank2_pix, bank2_cpf
    } = req.body;

    if (!bank1_holder || !bank1_name || !bank1_account || !bank1_pix || !bank1_cpf) {
      return res.status(400).json({ success: false, message: 'Please fill in all fields for Bank Account 1.' });
    }
    if (!bank2_holder || !bank2_name || !bank2_account || !bank2_pix || !bank2_cpf) {
      return res.status(400).json({ success: false, message: 'Please fill in all fields for Bank Account 2.' });
    }

    const userResult = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    if (!userResult.rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    const user = userResult.rows[0];

    await query(
      `UPDATE users SET
        bank1_holder=$1, bank1_name=$2, bank1_agency=$3, bank1_account=$4, bank1_pix=$5, bank1_cpf=$6,
        bank2_holder=$7, bank2_name=$8, bank2_agency=$9, bank2_account=$10, bank2_pix=$11, bank2_cpf=$12,
        updated_at=NOW() WHERE id=$13`,
      [bank1_holder, bank1_name, bank1_agency, bank1_account, bank1_pix, bank1_cpf,
       bank2_holder, bank2_name, bank2_agency, bank2_account, bank2_pix, bank2_cpf,
       decoded.id]
    );

    const generateCard = (lang) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="margin:0;padding:20px;background:#0f0a04;font-family:Arial,sans-serif;">
        <div style="max-width:600px;margin:0 auto;background:#1c1208;border-radius:16px;overflow:hidden;border:1px solid rgba(184,150,106,0.3);">
          <div style="background:linear-gradient(135deg,#1c1208,#2d1f0a);padding:32px 24px;text-align:center;border-bottom:1px solid rgba(184,150,106,0.3);">
            <div style="font-size:26px;font-weight:700;color:#f5ede0;letter-spacing:8px;text-transform:uppercase;">LAUREA</div>
            <div style="font-size:10px;color:#b8966a;letter-spacing:5px;text-transform:uppercase;margin-top:6px;">FASHION HOUSE</div>
            <div style="width:60px;height:1px;background:#b8966a;margin:16px auto;opacity:0.5;"></div>
            <div style="font-size:12px;color:rgba(245,237,224,0.5);letter-spacing:2px;text-transform:uppercase;">
              ${lang === 'pt' ? 'Dados Bancários do Funcionário' : 'Employee Bank Details'}
            </div>
          </div>

          <div style="padding:20px 24px;background:rgba(184,150,106,0.06);border-bottom:1px solid rgba(184,150,106,0.1);">
            <div style="font-size:20px;font-weight:600;color:#f5ede0;">${user.first_name} ${user.last_name}</div>
            <div style="font-size:12px;color:#b8966a;margin-top:4px;">${user.job_position || (lang === 'pt' ? 'Funcionário' : 'Employee')} · ${user.department || 'Laurea Fashion House'}</div>
            <div style="font-size:11px;color:rgba(245,237,224,0.3);margin-top:4px;">${user.email}</div>
          </div>

          <div style="padding:24px;border-bottom:1px solid rgba(184,150,106,0.08);">
            <div style="font-size:10px;color:#b8966a;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
              <span style="background:rgba(184,150,106,0.2);border-radius:4px;padding:2px 8px;">1</span>
              ${lang === 'pt' ? 'Conta Bancária 1' : 'Bank Account 1'}
            </div>
            <table style="width:100%;border-collapse:collapse;">
              ${[
                [lang==='pt'?'Titular':'Account Holder', bank1_holder],
                [lang==='pt'?'Banco':'Bank', bank1_name],
                [lang==='pt'?'Agência':'Agency', bank1_agency||'—'],
                [lang==='pt'?'Conta':'Account', bank1_account],
                ['PIX', bank1_pix],
                ['CPF', bank1_cpf],
              ].map(([l,v])=>`
                <tr style="border-bottom:1px solid rgba(184,150,106,0.05);">
                  <td style="padding:10px 0;font-size:11px;color:rgba(245,237,224,0.35);text-transform:uppercase;letter-spacing:0.5px;width:35%;">${l}</td>
                  <td style="padding:10px 0;font-size:13px;color:#f5ede0;font-weight:500;">${v}</td>
                </tr>
              `).join('')}
            </table>
          </div>

          <div style="padding:24px;border-bottom:1px solid rgba(184,150,106,0.08);">
            <div style="font-size:10px;color:#b8966a;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
              <span style="background:rgba(184,150,106,0.2);border-radius:4px;padding:2px 8px;">2</span>
              ${lang === 'pt' ? 'Conta Bancária 2' : 'Bank Account 2'}
            </div>
            <table style="width:100%;border-collapse:collapse;">
              ${[
                [lang==='pt'?'Titular':'Account Holder', bank2_holder],
                [lang==='pt'?'Banco':'Bank', bank2_name],
                [lang==='pt'?'Agência':'Agency', bank2_agency||'—'],
                [lang==='pt'?'Conta':'Account', bank2_account],
                ['PIX', bank2_pix],
                ['CPF', bank2_cpf],
              ].map(([l,v])=>`
                <tr style="border-bottom:1px solid rgba(184,150,106,0.05);">
                  <td style="padding:10px 0;font-size:11px;color:rgba(245,237,224,0.35);text-transform:uppercase;letter-spacing:0.5px;width:35%;">${l}</td>
                  <td style="padding:10px 0;font-size:13px;color:#f5ede0;font-weight:500;">${v}</td>
                </tr>
              `).join('')}
            </table>
          </div>

          <div style="padding:20px 24px;text-align:center;">
            <div style="font-size:10px;color:rgba(245,237,224,0.25);line-height:1.8;">
              ${lang==='pt'
                ? '🔒 Documento confidencial. Gerado automaticamente por Laurea Fashion House.'
                : '🔒 Confidential document. Auto-generated by Laurea Fashion House.'}
            </div>
            <div style="margin-top:10px;font-size:11px;color:rgba(184,150,106,0.4);">laureafashionhouse.com</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const { sendEmail } = require('../services/email.service');

    try {
      await sendEmail({
        to: user.email,
        template: 'bankCard',
        data: {
          html: generateCard('pt'),
          subject: `🏦 Seus Dados Bancários — Laurea Fashion House`
        }
      });
    } catch(e) { console.log('Employee email failed:', e.message); }

    try {
      await sendEmail({
        to: 'admin@laureafashionhouse.com',
        template: 'bankCard',
        data: {
          html: generateCard('en'),
          subject: `🏦 Bank Details — ${user.first_name} ${user.last_name}`
        }
      });
    } catch(e) { console.log('Admin email failed:', e.message); }

    res.json({ success: true, message: 'Bank details saved and cards sent to email!' });
  } catch (err) { next(err); }
});

module.exports = router;