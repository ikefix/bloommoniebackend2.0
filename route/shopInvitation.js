import { Router } from "express";
import User from "../models/user.js";
import Shop from "../models/shop.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import sendEmail from "../service/sendEmail.js";
import emailTemplates from "../templates/emailTemplates.js";

const router = Router();

/* =========================
   SHOP INVITATION SIGNUP
========================= */
router.post("/accept-invitation", async (req, res) => {
  try {
    const { token, shopId, name, password, role = "cashier" } = req.body;
    
    // Find shop by ID
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      // Add existing user to shop if not already added
      if (!shop.allowedUsers.includes(existingUser._id)) {
        shop.allowedUsers.push(existingUser._id);
        await shop.save();
      }
      return res.status(200).json({ 
        message: "You've been added to the shop! Please login.",
        userExists: true 
      });
    }
    
    // Create new user from invitation
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = new User({
      name,
      email: req.body.email,
      password: hashedPassword,
      role,
      verified: true, // Auto-verify from invitation
      termsAndConditionsAccepted: true,
      invitationToken: token
    });
    
    await newUser.save();
    
    // Add user to shop's allowed users
    if (!shop.allowedUsers || !Array.isArray(shop.allowedUsers)) {
      shop.allowedUsers = [];
    }
    shop.allowedUsers.push(newUser._id);
    await shop.save();
    
    // Send welcome email
    await sendEmail(
      newUser.email,
      "Welcome to Bloomrest!",
      emailTemplates.welcome(newUser.name, shop.shopName)
    );
    
    res.status(201).json({ 
      message: "Account created successfully! You can now login.",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   GOOGLE SIGNUP FROM INVITATION
========================= */
router.post("/google-signup", async (req, res) => {
  try {
    const { idToken, shopId, role = "cashier" } = req.body;
    
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

    // Find shop
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Find or create user
    let user = await User.findOne({ email: tokenInfo.email });
    
    if (!user) {
      // Create new user from Google data
      const newUser = new User({
        name: tokenInfo.name,
        email: tokenInfo.email,
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        role,
        profileImage: tokenInfo.picture,
        verified: true,
        termsAndConditionsAccepted: true,
        authProvider: 'google',
        googleId: tokenInfo.sub
      });
      
      user = await newUser.save();
      
      // Add user to shop
      if (!shop.allowedUsers || !Array.isArray(shop.allowedUsers)) {
        shop.allowedUsers = [];
      }
      shop.allowedUsers.push(user._id);
      await shop.save();
      
      // Send welcome email
      await sendEmail(
        user.email,
        "Welcome to Bloomrest!",
        emailTemplates.welcome(user.name, shop.shopName)
      );
    } else {
      // Add existing user to shop if not already added
      if (!shop.allowedUsers.includes(user._id)) {
        shop.allowedUsers.push(user._id);
        await shop.save();
      }
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '70d' }
    );
    
    res.json({
      message: "Successfully joined shop!",
      token: jwtToken,
      user: { user }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
