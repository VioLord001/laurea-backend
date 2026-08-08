const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'mail.privateemail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

const emailTemplates = {
  welcome: (data) => ({
    subject: 'Welcome to Laurea Fashion House 👗',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#2a1e10;">
        <div style="background:#1c1208;padding:24px;text-align:center;">
          <h1 style="color:#b8966a;letter-spacing:4px;font-size:22px;margin:0;">LAUREA</h1>
          <p style="color:#f5ede0;font-size:10px;letter-spacing:4px;margin:4px 0 0;">FASHION HOUSE</p>
        </div>
        <div style="padding:32px 24px;">
          <h2>Welcome, ${data.firstName}! 🎉</h2>
          <p>Thank you for joining the Laurea family. We are delighted to have you with us.</p>
          <p>Discover our latest collections — Women, Men, Kids, Bags, Jewellery, Shoes and more.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${process.env.CLIENT_URL}" style="background:#b8966a;color:#1c1208;padding:14px 32px;text-decoration:none;font-weight:600;letter-spacing:2px;font-size:12px;text-transform:uppercase;border-radius:6px;display:inline-block;">
              Shop the collection
            </a>
          </div>
          <p style="color:#8a7a6a;font-size:12px;">Use code <strong>LAUREA20</strong> for 20% off your first order.</p>
        </div>
        <div style="background:#f5ede0;padding:16px 24px;font-size:11px;color:#8a7a6a;text-align:center;">
          <p>© 2026 Laurea Fashion House. All rights reserved.</p>
          <p>laureafashionhouse.com</p>
        </div>
      </div>
    `
  }),

  verificationCode: (data) => ({
    subject: `${data.code} — Your Laurea verification code`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#2a1e10;">
        <div style="background:#1c1208;padding:24px;text-align:center;">
          <h1 style="color:#b8966a;letter-spacing:4px;font-size:22px;margin:0;">LAUREA</h1>
          <p style="color:#f5ede0;font-size:10px;letter-spacing:4px;margin:4px 0 0;">FASHION HOUSE</p>
        </div>
        <div style="padding:32px 24px;text-align:center;">
          <h2 style="color:#1c1208;">${data.type === 'login' ? 'Login Verification' : 'Verify Your Email'}</h2>
          <p style="color:#8a7a6a;">Hello ${data.firstName}, use the code below to ${data.type === 'login' ? 'complete your login' : 'verify your email address'}.</p>
          <div style="background:#faf8f5;border:2px solid #b8966a;border-radius:12px;padding:32px;margin:24px 0;">
            <p style="font-size:48px;font-weight:700;letter-spacing:12px;color:#1c1208;margin:0;">${data.code}</p>
            <p style="color:#8a7a6a;font-size:12px;margin:12px 0 0;">This code expires in <strong>10 minutes</strong></p>
          </div>
          <p style="color:#8a7a6a;font-size:12px;">If you did not request this code please ignore this email.</p>
          <p style="color:#8a7a6a;font-size:12px;">Do not share this code with anyone.</p>
        </div>
        <div style="background:#f5ede0;padding:16px 24px;font-size:11px;color:#8a7a6a;text-align:center;">
          <p>© 2026 Laurea Fashion House. All rights reserved.</p>
          <p>laureafashionhouse.com</p>
        </div>
      </div>
    `
  }),

  orderConfirmation: (data) => ({
    subject: `Order confirmed — ${data.order.order_number}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#2a1e10;">
        <div style="background:#1c1208;padding:24px;text-align:center;">
          <h1 style="color:#b8966a;letter-spacing:4px;font-size:22px;margin:0;">LAUREA</h1>
          <p style="color:#f5ede0;font-size:10px;letter-spacing:4px;margin:4px 0 0;">FASHION HOUSE</p>
        </div>
        <div style="padding:32px 24px;">
          <h2>Your order is confirmed ✅</h2>
          <p>Hello ${data.firstName}, thank you for your order!</p>
          <div style="background:#faf8f5;border:1px solid #e0d8cc;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="margin:0 0 8px;"><strong>Order number:</strong> ${data.order.order_number}</p>
            <p style="margin:0 0 8px;"><strong>Total:</strong> $${parseFloat(data.order.total_amount).toFixed(2)}</p>
            <p style="margin:0;"><strong>Status:</strong> ${data.order.status}</p>
          </div>
          <p>We will email you again when your order ships with tracking information.</p>
        </div>
        <div style="background:#f5ede0;padding:16px 24px;font-size:11px;color:#8a7a6a;text-align:center;">
          <p>© 2026 Laurea Fashion House. All rights reserved.</p>
        </div>
      </div>
    `
  }),

  passwordReset: (data) => ({
    subject: 'Reset your Laurea password',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#2a1e10;">
        <div style="background:#1c1208;padding:24px;text-align:center;">
          <h1 style="color:#b8966a;letter-spacing:4px;font-size:22px;margin:0;">LAUREA</h1>
        </div>
        <div style="padding:32px 24px;">
          <h2>Password reset request</h2>
          <p>Hello ${data.firstName}, we received a request to reset your password.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${data.resetUrl}" style="background:#b8966a;color:#1c1208;padding:14px 32px;text-decoration:none;font-weight:600;letter-spacing:2px;font-size:12px;text-transform:uppercase;border-radius:6px;display:inline-block;">
              Reset my password
            </a>
          </div>
          <p style="color:#8a7a6a;font-size:12px;">This link expires in 10 minutes. If you did not request this please ignore this email.</p>
        </div>
        <div style="background:#f5ede0;padding:16px 24px;font-size:11px;color:#8a7a6a;text-align:center;">
          <p>© 2026 Laurea Fashion House. All rights reserved.</p>
        </div>
      </div>
    `
  }),

  employeeApproved: (data) => ({
    subject: '✅ Your Laurea Employee Account Has Been Approved!',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#2a1e10;">
        <div style="background:#1c1208;padding:24px;text-align:center;">
          <h1 style="color:#b8966a;letter-spacing:4px;font-size:22px;margin:0;">LAUREA</h1>
          <p style="color:#f5ede0;font-size:10px;letter-spacing:4px;margin:4px 0 0;">FASHION HOUSE</p>
        </div>
        <div style="padding:32px 24px;text-align:center;">
          <div style="font-size:64px;margin-bottom:16px;">✅</div>
          <h2 style="color:#1c1208;">Congratulations, ${data.firstName}!</h2>
          <p style="color:#8a7a6a;line-height:1.7;">Your employee account has been reviewed and <strong style="color:#3b6d11;">approved</strong> by the Laurea Fashion House admin team.</p>
          <div style="background:#f0fff4;border:1px solid #ccffcc;border-radius:8px;padding:20px;margin:24px 0;">
            <p style="margin:0;color:#1a7a3a;font-weight:600;">You can now log in to your employee account!</p>
          </div>
          <a href="${data.loginUrl}" style="background:#b8966a;color:#1c1208;padding:14px 32px;text-decoration:none;font-weight:600;letter-spacing:2px;font-size:12px;text-transform:uppercase;border-radius:6px;display:inline-block;">
            Log In Now
          </a>
        </div>
        <div style="background:#f5ede0;padding:16px 24px;font-size:11px;color:#8a7a6a;text-align:center;">
          <p>© 2026 Laurea Fashion House. All rights reserved.</p>
          <p>laureafashionhouse.com</p>
        </div>
      </div>
    `
  }),

  employeeRejected: (data) => ({
    subject: 'Update on Your Laurea Employee Application',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#2a1e10;">
        <div style="background:#1c1208;padding:24px;text-align:center;">
          <h1 style="color:#b8966a;letter-spacing:4px;font-size:22px;margin:0;">LAUREA</h1>
          <p style="color:#f5ede0;font-size:10px;letter-spacing:4px;margin:4px 0 0;">FASHION HOUSE</p>
        </div>
        <div style="padding:32px 24px;">
          <h2 style="color:#1c1208;">Hello ${data.firstName},</h2>
          <p style="color:#8a7a6a;line-height:1.7;">Thank you for applying to join the Laurea Fashion House team. After carefully reviewing your application, we are unable to approve your employee account at this time.</p>
          ${data.reason && data.reason.trim() !== '' ? `
          <div style="background:#fff0f0;border-left:4px solid #cc0000;border-radius:4px;padding:16px 20px;margin:24px 0;">
            <p style="margin:0 0 8px;color:#cc0000;font-weight:700;font-size:14px;">Reason for rejection:</p>
            <p style="margin:0;color:#2a1e10;line-height:1.7;font-size:14px;">${data.reason}</p>
          </div>
          ` : ''}
          <p style="color:#8a7a6a;line-height:1.7;">If you believe this is a mistake or would like to reapply with correct information, please contact us at <a href="mailto:support@laureafashionhouse.com" style="color:#b8966a;">support@laureafashionhouse.com</a></p>
          <div style="text-align:center;margin:24px 0;">
            <a href="mailto:support@laureafashionhouse.com" style="background:#1c1208;color:#f5ede0;padding:14px 32px;text-decoration:none;font-weight:600;letter-spacing:2px;font-size:12px;text-transform:uppercase;border-radius:6px;display:inline-block;">
              Contact Support
            </a>
          </div>
        </div>
        <div style="background:#f5ede0;padding:16px 24px;font-size:11px;color:#8a7a6a;text-align:center;">
          <p>© 2026 Laurea Fashion House. All rights reserved.</p>
          <p>laureafashionhouse.com</p>
        </div>
      </div>
    `
  })
};

const sendEmail = async ({ to, subject, template, data, html }) => {
  try {
    let content;
    if (template === 'bankCard') {
      content = { subject: data.subject, html: data.html };
    } else {
      const templateFn = emailTemplates[template];
      content = templateFn ? templateFn(data) : { subject, html };
    }
    const info = await transporter.sendMail({
      from: `"Laurea Fashion House" <${process.env.SMTP_USER}>`,
      replyTo: 'support@laureafashionhouse.com',
      to,
      subject: content.subject,
      html: content.html,
      headers: {
        'X-Mailer': 'Laurea Fashion House Mailer',
        'X-Priority': '3',
      }
    });
    console.log('Email sent:', info.messageId);
    return info;
  } catch (err) {
    console.error('Email error:', err.message);
  }
};

module.exports = { sendEmail };