const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for 587 (STARTTLS)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Send an email.
 * @param {object} opts - { to, subject, html }
 */
async function sendMail({ to, subject, html }) {
    return transporter.sendMail({
        from: process.env.EMAIL_FROM || 'COET Resource Booking <no-reply@coet.edu>',
        to,
        subject,
        html
    });
}

module.exports = { sendMail };
