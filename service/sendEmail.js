import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.GOOGLE_APP_PASSWORD,
    },
});

/**
 * Send Email Utility
 * @param {String} to - Recipient email
 * @param {String} subject - Email subject
 * @param {String} html - HTML content
 */
const sendEmail = async (to, subject, html) => {
    try {
        const mailOptions = {
            from: `"Bloommonie POS" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        };

        const info = await transporter.sendMail(mailOptions);

        console.log("✅ Email sent:", info.messageId);
        return true;

    } catch (error) {
        console.error("❌ Email sending failed:", error.message);
        return false;
    }
};

export default sendEmail;