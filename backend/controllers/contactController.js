const db = require('../config/db');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const EMAIL_FROM = process.env.EMAIL_FROM;
const DEV_EMAIL = process.env.DEV_EMAIL;
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendFeedback = async (req, res) => {
  const { userId, message } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ message: 'User ID and message are required' });
  }

  try {
    const [users] = await db.query('SELECT name, email, role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    await sgMail.send({
      to: DEV_EMAIL,
      from: EMAIL_FROM,
      subject: `New Feedback from ${user.name} (${user.role})`,
      text: `
Feedback from AttendAce user:

Name: ${user.name}
Email: ${user.email}
Role: ${user.role}

Message:
${message}
      `,
      html: `
        <div style="font-family: Arial, sans-serif; padding:20px; background:#f9fafb;">
          <h2 style="color:#2d6a4f;">New Feedback from ${user.name} (${user.role})</h2>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Message:</strong></p>
          <div style="padding:12px; background:#fff; border-radius:8px; border:1px solid #ddd;">${message}</div>
        </div>
      `
    });

    res.json({ message: 'Message sent! Our team will contact you shortly.' });
  } catch (err) {
    console.error('Send Feedback error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};