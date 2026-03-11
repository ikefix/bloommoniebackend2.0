import { Router } from "express";
import User from "../models/user.js";
import auth from "../middlewares/auth.js";
import sendEmail from "../service/sendEmail.js";
import sendOtp from "../service/sendOtp.js"; // Twilio OTP sender
import bcrypt from "bcrypt";
import crypto from "crypto";

const router = Router();

// OTP rate limiter map: phone -> { count, lastSent }
const otpLimiter = new Map();
const MAX_OTP_PER_WINDOW = 3;
const OTP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const OTP_EXPIRY_MINUTES = 5; // OTP valid for 5 minutes

/* =========================
   REGISTER USER
========================= */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, termsAndConditionsAccepted } = req.body;
    if (!name || !email || !password || !phone)
      return res.status(400).json({ message: "All fields are required" });
    if (!termsAndConditionsAccepted)
      return res.status(400).json({ message: "You must accept terms and conditions" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      verificationToken,
      verified: false,
      termsAndConditionsAccepted,
    });

    await newUser.save();

    const verificationLink = `${process.env.APP_VERIFY_URL}/${verificationToken}`;
    await sendEmail(
      email,
      "Verify Your Bloomrest Account",
      `<p>Hello ${name}, please verify your email: <a href="${verificationLink}">Verify Account</a></p>`
    );

    res.status(201).json({ message: "User registered successfully. Please verify your email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   SEND PHONE OTP
========================= */
router.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Rate limiter
    const now = Date.now();
    const limiter = otpLimiter.get(phone) || { count: 0, lastSent: 0 };

    if (now - limiter.lastSent < OTP_WINDOW_MS && limiter.count >= MAX_OTP_PER_WINDOW) {
      return res.status(429).json({ message: "Too many OTP requests. Try later." });
    }

    if (now - limiter.lastSent > OTP_WINDOW_MS) {
      limiter.count = 0; // reset count if window passed
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    user.otp = hashedOtp;
    user.otpCreatedAt = new Date();
    await user.save();

    // Update limiter
    limiter.count++;
    limiter.lastSent = now;
    otpLimiter.set(phone, limiter);

    await sendOtp(phone, otp); // Twilio SMS

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   VERIFY PHONE OTP
========================= */
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.otp) return res.status(400).json({ message: "No OTP found. Request new OTP." });

    const otpAge = (Date.now() - new Date(user.otpCreatedAt).getTime()) / 60000;
    if (otpAge > OTP_EXPIRY_MINUTES) return res.status(400).json({ message: "OTP expired" });

    const isValid = await bcrypt.compare(otp, user.otp);
    if (!isValid) return res.status(400).json({ message: "Invalid OTP" });

    user.verified = true;
    user.otp = null;
    user.otpCreatedAt = null;
    await user.save();

    res.json({ message: "Phone verified successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   LOGIN USER
========================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = crypto.randomBytes(32).toString("hex"); // replace with JWT in production
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   GET USERS (Protected)
========================= */
router.get("/", auth, async (req, res) => {
  try {
    const users = await User.find().select("-password -verificationToken -otp -otpCreatedAt");
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   ADMIN CREATE USER
========================= */
router.post("/create-user", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Only admin allowed" });

    const { name, email, phone, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ name, email, phone, password: hashedPassword, role });
    await newUser.save();

    res.json({ message: "User created by admin", user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;