import { emailQueue } from '../queues/index.js';
import sendEmail from '../service/sendEmail.js';
import emailTemplates from '../templates/emailTemplates.js';

// Process email jobs
emailQueue.process('send-email', async (job) => {
  const { to, subject, template, data } = job.data;

  try {
    await sendEmail(to, subject, template);
    console.log(`Email sent successfully to ${to}`);
    return { success: true, to };
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
});

// Process OTP email jobs
emailQueue.process('send-otp', async (job) => {
  const { email, otp, name } = job.data;

  try {
    const template = emailTemplates.emailVerification(name, otp);
    await sendEmail(email, 'Your Verification Code', template);
    console.log(`OTP email sent to ${email}`);
    return { success: true, email };
  } catch (error) {
    console.error(`Failed to send OTP to ${email}:`, error);
    throw error;
  }
});

// Process welcome email jobs
emailQueue.process('send-welcome', async (job) => {
  const { email, name } = job.data;

  try {
    const template = emailTemplates.googleWelcome(name);
    await sendEmail(email, 'Welcome to Bloomrest!', template);
    console.log(`Welcome email sent to ${email}`);
    return { success: true, email };
  } catch (error) {
    console.error(`Failed to send welcome email to ${email}:`, error);
    throw error;
  }
});

// Process verification email jobs
emailQueue.process('send-verification', async (job) => {
  const { email, name, verificationCode, verificationLink, deepLink, shopName } = job.data;

  try {
    const template = emailTemplates.shopVerification(name, verificationCode, verificationLink, shopName, deepLink);
    await sendEmail(email, 'Shop Access Invitation - Bloomonie', template);
    console.log(`Verification email sent to ${email}`);
    return { success: true, email };
  } catch (error) {
    console.error(`Failed to send verification email to ${email}:`, error);
    throw error;
  }
});

// Process password reset email jobs
emailQueue.process('send-password-reset', async (job) => {
  const { email, name, resetLink, deepLink } = job.data;

  try {
    const template = emailTemplates.passwordReset(name || 'User', resetLink, deepLink);
    await sendEmail(email, 'Password Reset Request', template);
    console.log(`Password reset email sent to ${email}`);
    return { success: true, email };
  } catch (error) {
    console.error(`Failed to send password reset email to ${email}:`, error);
    throw error;
  }
});

console.log('Email worker started');
