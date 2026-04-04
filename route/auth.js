import { Router } from "express";
import User from "../models/user.js";
import auth from "../middlewares/auth.js";
import sendEmail from "../service/sendEmail.js";
import sendOtp from "../service/sendOtp.js"; // Twilio OTP sender
import bcrypt from "bcrypt";
import crypto from "crypto";
import emailTemplates from "../templates/emailTemplates.js";

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
      emailTemplates.emailVerification(name, verificationLink)
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
// router.post("/send-otp", async (req, res) => {
//   try {
//     const { phone } = req.body;
//     const user = await User.findOne({ phone });
//     if (!user) return res.status(404).json({ message: "User not found" });

//     // Rate limiter
//     const now = Date.now();
//     const limiter = otpLimiter.get(phone) || { count: 0, lastSent: 0 };

//     if (now - limiter.lastSent < OTP_WINDOW_MS && limiter.count >= MAX_OTP_PER_WINDOW) {
//       return res.status(429).json({ message: "Too many OTP requests. Try later." });
//     }

//     if (now - limiter.lastSent > OTP_WINDOW_MS) {
//       limiter.count = 0; // reset count if window passed
//     }

//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     const hashedOtp = await bcrypt.hash(otp, 10);
//     user.otp = hashedOtp;
//     user.otpCreatedAt = new Date();
//     await user.save();

//     // Update limiter
//     limiter.count++;
//     limiter.lastSent = now;
//     otpLimiter.set(phone, limiter);

//     await sendOtp(phone, otp); // Twilio SMS

//     res.json({ message: "OTP sent successfully" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// /* =========================
//    VERIFY PHONE OTP
// ========================= */
// router.post("/verify-otp", async (req, res) => {
//   try {
//     const { phone, otp } = req.body;
//     const user = await User.findOne({ phone });
//     if (!user) return res.status(404).json({ message: "User not found" });

//     if (!user.otp) return res.status(400).json({ message: "No OTP found. Request new OTP." });

//     const otpAge = (Date.now() - new Date(user.otpCreatedAt).getTime()) / 60000;
//     if (otpAge > OTP_EXPIRY_MINUTES) return res.status(400).json({ message: "OTP expired" });

//     const isValid = await bcrypt.compare(otp, user.otp);
//     if (!isValid) return res.status(400).json({ message: "Invalid OTP" });

//     user.verified = true;
//     user.otp = null;
//     user.otpCreatedAt = null;
//     await user.save();

//     res.json({ message: "Phone verified successfully" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

/* =========================
   LOGIN USER
========================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('-password -verificationToken -otp -otpCreatedAt -resetPasswordToken -resetPasswordTokenExpiry');
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
   FORGOT PASSWORD
========================= */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    
    user.resetPasswordToken = resetToken;
    user.resetPasswordTokenExpiry = resetTokenExpiry;
    await user.save();

    // Send reset email
    const resetLink = `${process.env.APP_RESET_PASSWORD_URL}/${resetToken}`;
    await sendEmail(
      email,
      "Reset Your Bloomrest Password",
      emailTemplates.passwordReset(user.name, resetLink)
    );

    res.json({ message: "Password reset link sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   RESET PASSWORD
========================= */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordTokenExpiry = null;
    await user.save();

    // Send confirmation email
    await sendEmail(
      user.email,
      "Password Reset Successful",
      emailTemplates.passwordResetConfirmation(user.name)
    );

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   GOOGLE AUTH - REDIRECT
========================= */
router.get("/google", (req, res) => {
  // Debug: Check if environment variables are loaded
  console.log('Google OAuth Debug:');
  console.log('CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING');
  console.log('CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING');
  console.log('REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);
  
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    return res.status(500).json({ 
      error: "Google OAuth configuration missing",
      missing: {
        clientId: !process.env.GOOGLE_CLIENT_ID,
        clientSecret: !process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: !process.env.GOOGLE_REDIRECT_URI
      }
    });
  }
  
  // In production, use Google OAuth2 library
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
    `redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&` +
    `response_type=code&` +
    `scope=email profile&` +
    `access_type=offline`;
  
  console.log('Google Auth URL:', googleAuthUrl);
  res.redirect(googleAuthUrl);
});

/* =========================
   GOOGLE AUTH - CALLBACK
========================= */
router.get("/google/callback", async (req, res) => {
  try {
    const { code } = req.query;
    
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      return res.status(400).json({ message: "Google authentication failed" });
    }

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const googleUser = await userResponse.json();
    
    if (!googleUser.email) {
      return res.status(400).json({ message: "Failed to get user information from Google" });
    }

    // Find or create user
    let user = await User.findOne({ email: googleUser.email });
    
    if (!user) {
      // Create new user from Google data
      const newUser = new User({
        name: googleUser.name,
        email: googleUser.email,
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10), // Random password
        phone: googleUser.phone || '',
        profileImage: googleUser.picture,
        verified: true, // Google users are pre-verified
        termsAndConditionsAccepted: true,
        authProvider: 'google',
        googleId: googleUser.id
      });
      
      user = await newUser.save();
      
      // Send welcome email for new Google users
      await sendEmail(
        user.email,
        "Welcome to Bloomrest!",
        emailTemplates.googleWelcome(user.name)
      );
    } else if (!user.authProvider) {
      // Update existing user with Google auth
      user.authProvider = 'google';
      user.googleId = googleUser.id;
      user.verified = true;
      await user.save();
    }

    // Generate JWT token (replace with proper JWT in production)
    const token = crypto.randomBytes(32).toString("hex");
    
    // Redirect to frontend with token
    const redirectUrl = `http://localhost:5173/auth/google/callback?token=${token}&userId=${user._id}`;
    res.redirect(redirectUrl);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   GOOGLE AUTH - SIGN-IN (Alternative method)
========================= */
router.post("/google/signin", async (req, res) => {
  try {
    const { idToken } = req.body;
    
    // Verify Google ID token
    const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${idToken}`);
    const tokenInfo = await response.json();
    
    if (tokenInfo.error) {
      return res.status(400).json({ message: "Invalid Google ID token" });
    }

    // Verify the token matches our client
    if (tokenInfo.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(400).json({ message: "Token audience mismatch" });
    }

    // Find or create user
    let user = await User.findOne({ email: tokenInfo.email });
    
    if (!user) {
      // Create new user from Google data
      const newUser = new User({
        name: tokenInfo.name,
        email: tokenInfo.email,
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        phone: '',
        profileImage: tokenInfo.picture,
        verified: true,
        termsAndConditionsAccepted: true,
        authProvider: 'google',
        googleId: tokenInfo.sub
      });
      
      user = await newUser.save();
      
      // Send welcome email for new Google users
      await sendEmail(
        user.email,
        "Welcome to Bloomrest!",
        emailTemplates.googleWelcome(user.name)
      );
    } else if (!user.authProvider) {
      // Update existing user with Google auth
      user.authProvider = 'google';
      user.googleId = tokenInfo.sub;
      user.verified = true;
      await user.save();
    }

    // Generate JWT token
    const token = crypto.randomBytes(32).toString("hex");
    
    res.json({
      message: "Google sign-in successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        verified: user.verified,
        authProvider: user.authProvider
      }
    });
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
    const users = await User.find().select("-password -verificationToken -otp -otpCreatedAt -resetPasswordToken -resetPasswordTokenExpiry");
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