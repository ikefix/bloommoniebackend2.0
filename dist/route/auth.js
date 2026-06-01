import { Router } from "express";
import User from "../models/user.js";
import jwt from "jsonwebtoken";
import auth from "../middlewares/auth.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import emailTemplates from "../templates/emailTemplates.js";
import shop from "../models/shop.js";
import { emailQueue } from "../queues/index.js";
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
        if (existing)
            return res.status(409).json({ message: "User already exists" });
        const phoneExisting = await User.findOne({ phone });
        if (phoneExisting)
            return res.status(409).json({ message: "Phone number already in use" });
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            otp,
            otpCreatedAt: otpExpiry,
            verified: false,
            termsAndConditionsAccepted,
        });
        await newUser.save();
        // Create default shop for the new user
        const defaultShopCode = `${name.substring(0, 3).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const shopData = {
            name: `${name}'s Shop`,
            code: defaultShopCode,
            type: "retail",
            description: "Default shop for new user",
            businessInfo: {
                businessName: `${name}'s Business`,
                businessType: "sole_proprietorship",
                email: email,
                phone: phone
            },
            address: {
                street: "Default Address",
                city: "Default City",
                state: "Default State",
                country: "Nigeria",
                zipCode: "000000"
            },
            settings: {
                currency: "NGN",
                timezone: "Africa/Lagos",
                dateFormat: "DD/MM/YYYY",
                taxSettings: {
                    taxEnabled: true,
                    taxRate: 7.5,
                    taxIncluded: false
                },
                receiptSettings: {
                    showLogo: true,
                    showBusinessInfo: true,
                    showCustomerInfo: true,
                    showTaxDetails: true,
                    showPaymentDetails: true,
                    footerText: "Thank you for your business!"
                },
                paymentMethods: [
                    {
                        type: "cash",
                        name: "Cash",
                        isActive: true,
                        fee: 0
                    }
                ],
                securitySettings: {
                    requireLoginForSales: true,
                    requireLoginForReports: true,
                    requireLoginForInventory: true,
                    sessionTimeout: 30,
                    maxLoginAttempts: 5,
                    passwordComplexity: true
                }
            },
            branding: {
                primaryColor: "#007bff",
                secondaryColor: "#6c757d",
                accentColor: "#28a745",
                fontFamily: "Arial"
            },
            createdBy: newUser._id,
            allowedUsers: [newUser._id]
        };
        const newShop = new shop(shopData);
        await newShop.save();
        // Queue email sending instead of blocking
        await emailQueue.add('send-otp', {
            email,
            otp,
            name
        });
        res.status(201).json({ message: "User registered successfully. Please verify your email." });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
/* =========================
   VERIFY EMAIL WITH OTP
========================= */
router.post("/verify-email", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: "Email and OTP are required" });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (user.verified) {
            return res.status(400).json({ message: "Email already verified" });
        }
        // Check if OTP matches
        if (user.otp !== otp) {
            return res.status(400).json({ message: "Invalid OTP" });
        }
        // Check if OTP has expired
        if (user.otpCreatedAt && new Date(user.otpCreatedAt) < new Date()) {
            return res.status(400).json({ message: "OTP has expired" });
        }
        // Verify user and clear OTP
        user.verified = true;
        user.otp = null;
        user.otpCreatedAt = null;
        await user.save();
        // Generate JWT token
        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '70d' });
        res.json({
            message: "Email verified successfully",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                verified: user.verified
            }
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
/* =========================
   RESEND OTP
========================= */
router.post("/resend-otp", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (user.verified) {
            return res.status(400).json({ message: "Email already verified" });
        }
        // Generate new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        user.otp = otp;
        user.otpCreatedAt = otpExpiry;
        await user.save();
        // Queue OTP email sending instead of blocking
        await emailQueue.add('send-otp', {
            email,
            otp,
            name: user.name
        });
        res.json({ message: "New OTP sent to your email" });
    }
    catch (err) {
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
        if (!user)
            return res.status(404).json({ message: "User not found" });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            return res.status(401).json({ message: "Invalid credentials" });
        const shops = await shop.find({ createdBy: user._id });
        // Also find shops where user is in allowedUsers
        const allowedShops = await shop.find({ allowedUsers: user._id });
        // Combine all shops user has access to and remove duplicates
        const allAccessibleShops = [...shops, ...allowedShops];
        const uniqueShops = allAccessibleShops.filter((shop, index, self) => index === self.findIndex((s) => s._id.toString() === shop._id.toString()));
        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '70d' });
        res.json({ token, user, shops: uniqueShops });
    }
    catch (err) {
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
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
        user.resetPasswordToken = resetToken;
        user.resetPasswordTokenExpiry = resetTokenExpiry;
        await user.save();
        // Build reset links
        // resetLink is always the HTTPS web URL (email clients block custom schemes on primary buttons)
        // deepLink is the mobile deep link, shown as a secondary "Open in App" button
        const webLink = `${process.env.APP_RESET_PASSWORD_URL}/${resetToken}`;
        const deepLink = `${process.env.APP_DEEP_LINK_SCHEME || 'bloomonie'}://reset-password/${resetToken}`;
        const resetLink = webLink; // always HTTPS for email compatibility
        await emailQueue.add('send-password-reset', {
            email,
            name: user.name,
            resetLink,
            deepLink,
            webLink
        });
        res.json({ message: "Password reset link sent to your email" });
    }
    catch (err) {
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
        // Queue confirmation email instead of blocking
        await emailQueue.add('send-email', {
            to: user.email,
            subject: "Password Reset Successful",
            template: emailTemplates.passwordResetConfirmation(user.name)
        });
        res.json({ message: "Password reset successfully" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
/* =========================
   OPEN IN APP REDIRECT
   HTTPS bridge for deep links in emails — email clients block bloomonie:// directly
   but allow HTTPS links. This endpoint serves an HTML page that attempts the deep
   link. No automatic fallback to web URL — that was causing the browser to open
   localhost:5173 instead of the Electron app.
========================= */
router.get("/open-in-app", (req, res) => {
    const { link } = req.query;
    if (!link) {
        return res.status(400).send("Missing link parameter");
    }
    // Decode and sanitize — only allow our own deep link scheme
    const deepLink = decodeURIComponent(link);
    const scheme = process.env.APP_DEEP_LINK_SCHEME || 'bloomonie';
    if (!deepLink.startsWith(`${scheme}://`)) {
        return res.status(400).send("Invalid link");
    }
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Opening Bloomonie...</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #f0f8ff; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: white; padding: 48px 40px; border-radius: 20px; box-shadow: 0 10px 40px rgba(59,130,246,0.15); text-align: center; max-width: 420px; width: 90%; }
    .logo { font-size: 48px; margin-bottom: 16px; }
    h2 { color: #1e3a8a; font-size: 22px; margin-bottom: 10px; }
    p { color: #64748b; font-size: 15px; margin-bottom: 28px; line-height: 1.5; }
    .btn-open { display: inline-block; padding: 15px 40px; border-radius: 50px; font-weight: 700; font-size: 16px; text-decoration: none; background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; box-shadow: 0 8px 20px rgba(59,130,246,0.35); }
    .note { margin-top: 20px; font-size: 13px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🌸</div>
    <h2>Opening Bloomonie</h2>
    <p>Click the button below to open the Bloomonie desktop app and complete your action.</p>
    <a href="${deepLink}" class="btn-open" id="openBtn">Open in Bloomonie App</a>
    <p class="note">If the app doesn't open, make sure Bloomonie is installed on your device.</p>
  </div>
  <script>
    // Attempt to open the app automatically on page load
    // We do NOT auto-redirect to a web fallback — that was causing the browser
    // to open localhost:5173 instead of the Electron app.
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.location.href = "${deepLink}";
      }, 500);
    });
  </script>
</body>
</html>`);
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
    // Always use the configured redirect URI
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    // In production, use Google OAuth2 library
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${redirectUri}&` +
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
        if (!code || typeof code !== 'string') {
            return res.status(400).json({ message: "Authorization code is required" });
        }
        // Always use the configured redirect URI
        const rid_url = process.env.GOOGLE_REDIRECT_URI;
        console.log('Using configured redirect URI:', rid_url);
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
                redirect_uri: rid_url,
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
            // Create default shop for the new Google user
            const defaultShopCode = `${googleUser.name.substring(0, 3).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            const shopData = {
                name: `${googleUser.name}'s Shop`,
                code: defaultShopCode,
                type: "retail",
                description: "Default shop for new user",
                businessInfo: {
                    businessName: `${googleUser.name}'s Business`,
                    businessType: "sole_proprietorship",
                    email: googleUser.email,
                    phone: googleUser.phone || '+2348000000000'
                },
                address: {
                    street: "Default Address",
                    city: "Default City",
                    state: "Default State",
                    country: "Nigeria",
                    zipCode: "000000"
                },
                settings: {
                    currency: "NGN",
                    timezone: "Africa/Lagos",
                    dateFormat: "DD/MM/YYYY",
                    taxSettings: {
                        taxEnabled: true,
                        taxRate: 7.5,
                        taxIncluded: false
                    },
                    receiptSettings: {
                        showLogo: true,
                        showBusinessInfo: true,
                        showCustomerInfo: true,
                        showTaxDetails: true,
                        showPaymentDetails: true,
                        footerText: "Thank you for your business!"
                    },
                    paymentMethods: [
                        {
                            type: "cash",
                            name: "Cash",
                            isActive: true,
                            fee: 0
                        }
                    ],
                    securitySettings: {
                        requireLoginForSales: true,
                        requireLoginForReports: true,
                        requireLoginForInventory: true,
                        sessionTimeout: 30,
                        maxLoginAttempts: 5,
                        passwordComplexity: true
                    }
                },
                branding: {
                    primaryColor: "#007bff",
                    secondaryColor: "#6c757d",
                    accentColor: "#28a745",
                    fontFamily: "Arial"
                },
                createdBy: user._id,
                allowedUsers: [user._id]
            };
            const newShop = new shop(shopData);
            await newShop.save();
            // Queue welcome email for new Google users
            await emailQueue.add('send-welcome', {
                email: user.email,
                name: user.name,
                shopName: `${user.name}'s Shop`
            });
        }
        else if (!user.authProvider) {
            // Update existing user with Google auth
            user.authProvider = 'google';
            user.googleId = googleUser.id;
            user.verified = true;
            await user.save();
        }
        // Generate JWT token
        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '70d' });
        // Redirect to deep link if mobile, otherwise web frontend
        const scheme = process.env.APP_DEEP_LINK_SCHEME || 'bloomonie';
        const webCallbackUrl = process.env.APP_GOOGLE_CALLBACK_URL || 'http://localhost:5173/auth/google/callback';
        const deepLinkCallbackUrl = `${scheme}://google-callback?code=${code}`;
        // Use deep link when configured, otherwise fall back to web URL
        const redirectUrl = process.env.USE_DEEP_LINKS === 'true'
            ? `${deepLinkCallbackUrl}?token=${token}&userId=${user._id}`
            : `${webCallbackUrl}?token=${token}&userId=${user._id}`;
        res.redirect(redirectUrl);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
/* ========================
    API FOR FETCHING USER DATA
========================= */
router.get("/me", auth, async (req, res) => {
    try {
        console.log('JWT Token Debug:');
        console.log('Auth header:', req.header("Authorization"));
        console.log('User from middleware:', req.user);
        const user = await User.findById(req.user.id).select('-password -verificationToken -otp -otpCreatedAt -resetPasswordToken -resetPasswordTokenExpiry');
        const shops = await shop.find({ createdBy: req.user.id });
        // Also find shops where user is in allowedUsers
        const allowedShops = await shop.find({ allowedUsers: req.user.id });
        // Combine all shops user has access to and remove duplicates
        const allAccessibleShops = [...shops, ...allowedShops];
        const uniqueShops = allAccessibleShops.filter((shop, index, self) => index === self.findIndex((s) => s._id.toString() === shop._id.toString()));
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({ user, shops: uniqueShops });
    }
    catch (err) {
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
            // Queue welcome email for new Google users
            await emailQueue.add('send-welcome', {
                email: user.email,
                name: user.name,
                shopName: `${user.name}'s Shop`
            });
        }
        else if (!user.authProvider) {
            // Update existing user with Google auth
            user.authProvider = 'google';
            user.googleId = tokenInfo.sub;
            user.verified = true;
            await user.save();
        }
        // Generate JWT token
        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '70d' });
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
    }
    catch (err) {
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
    }
    catch (err) {
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
/* =========================
   PUBLIC ROUTES (NO AUTH)
========================= */
// Get all user IDs and emails (no auth required)
router.get("/public/all-users", async (req, res) => {
    try {
        const users = await User.find({}, { _id: 1, email: 1, name: 1 });
        const userData = users.map(user => ({
            id: user._id,
            email: user.email,
            name: user.name
        }));
        res.json({
            success: true,
            data: userData,
            count: userData.length
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
// Delete user by ID (no auth required)
router.delete("/public/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        await User.findByIdAndDelete(req.params.id);
        res.json({
            success: true,
            message: "User deleted successfully"
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
export default router;
