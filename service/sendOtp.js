import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;  // Your Twilio Account SID
const authToken = process.env.TWILIO_AUTH_TOKEN;    // Your Twilio Auth Token
const fromPhone = process.env.TWILIO_PHONE_NUMBER;  // Verified Twilio number

const client = twilio(accountSid, authToken);

/**
 * Send OTP to a phone number
 * @param {string} phone - E.164 format (+1234567890)
 * @param {string} otp - OTP code
 */
const sendOtp = async (phone, otp) => {
  try {
    const message = await client.messages.create({
      body: `Your Bloomrest OTP is: ${otp}`,
      from: fromPhone,
      to: phone,
    });

    console.log(`OTP sent to ${phone}: ${otp}, SID: ${message.sid}`);
    return message;
  } catch (err) {
    console.error("Twilio sendOtp error:", err);
    throw new Error("Failed to send OTP");
  }
};

export default sendOtp;