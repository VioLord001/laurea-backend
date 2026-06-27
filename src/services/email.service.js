// ============================================
// STAGE 8: EMAIL SERVICE (Resend)
// Order confirmations, password resets, etc.
// ============================================
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

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
            <a href="${process.env.CLIENT_URL}" style="background:#b8966a;color:#1c1208;padding:14px 32px;text-decoration:none;font-weight:600;letter-spacing:2px;font-size:12px;text-transform:uppercase;">
              Shop the collection
            </a>
          </div>
          <p style="color:#8a7a6a;font-size:12px;">Use code <strong>LAUREA20</strong> for 20% off your first order.</p>
        </div>
        <div style="background:#f5ede0;padding:16px 24px;font-size:11px;color:#8a7a6a;text-align:center;">
          <p>© 2026 Laurea Fashion House. All rights reserved.</p>
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
            <a href="${data.resetUrl}" style="background:#b8966a;color:#1c1208;padding:14px 32px;text-decoration:none;font-weight:600;letter-spacing:2px;font-size:12px;text-transform:uppercase;">
              Reset my password
            </a>
          </div>
          <p style="color:#8a7a6a;font-size:12px;">This link expires in 10 minutes. If you didn't request this, please ignore this email.</p>
        </div>
      </div>
    `
  })
};

const sendEmail = async ({ to, subject, template, data, html }) => {
  try {
    const templateFn = emailTemplates[template];
    const content = templateFn ? templateFn(data) : { subject, html };

    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Laurea Fashion House <noreply@laureafashionhouse.com>',
      to,
      subject: content.subject,
      html: content.html
    });

    return result;
  } catch (err) {
    console.error('Email send failed:', err);
    // Don't throw — email failure shouldn't break the request
  }
};

module.exports = { sendEmail };
