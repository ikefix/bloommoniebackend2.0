import { Router } from "express";
import User from "../models/user.js";
import Shop from "../models/shop.js";
import auth from "../middlewares/auth.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import sendEmail from "../service/sendEmail.js";
import emailTemplates from "../templates/emailTemplates.js";

const router = Router();

/* =========================
   ADD CASHIER/SELLER TO SHOP
========================= */
router.post("/add-cashier", auth, async (req, res) => {
  try {
    const { email, name, role = "cashier" } = req.body;
    
    // Check if user is shop owner
    const shop = await Shop.findOne({ createdBy: req.user.id });
    if (!shop) {
      return res.status(403).json({ message: "Only shop owners can add cashiers" });
    }
    
    // Initialize allowedUsers array if it doesn't exist
    if (!shop.allowedUsers || !Array.isArray(shop.allowedUsers)) {
      shop.allowedUsers = [];
    }
    
    // Check if user already exists
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      // Add user to shop's allowed users if not already added
      if (!shop.allowedUsers.includes(existingUser._id)) {
        shop.allowedUsers.push(existingUser._id);
        await shop.save();
      }
      return res.status(400).json({ message: "User already exists" });
    }
    
    // User doesn't exist - send invitation email
    const invitationToken = crypto.randomBytes(32).toString("hex");
    const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/shop-invitation?token=${invitationToken}&shopId=${shop._id}&shopName=${encodeURIComponent(shop.shopName)}`;
    
    // Send invitation email
    await sendEmail(
      email,
      "Shop Access Invitation - Bloomrest",
      emailTemplates.shopInvitation(name || email.split('@')[0], invitationLink, shop.shopName)
    );
    
    res.status(200).json({ 
      message: "User not found. Invitation email sent to create account.",
      requiresSignup: true
    });
    
    // Generate 6-digit alphanumeric code
    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Create new cashier/seller account
    const hashedPassword = await bcrypt.hash(verificationCode, 10);
    
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
      verified: false,
      verificationToken: verificationCode,
      termsAndConditionsAccepted: false
    });
    
    await newUser.save();
    
    // Add to shop's allowed users
    shop.allowedUsers.push(newUser._id);
    await shop.save();
    
    // Send verification email with code
    const verificationLink = `${process.env.APP_BASE_URL}/api/shop-verification-page`;
    await sendEmail(
      email,
      "Welcome to Bloomrest - Shop Access",
      emailTemplates.shopVerification(name, verificationCode, verificationLink, shop.shopName)
    );
    
    res.status(201).json({ 
      message: "Cashier/Seller added successfully. Verification email sent.",
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
   SHOP VERIFICATION PAGE (HTML)
========================= */
router.get("/shop-verification-page", (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shop Verification - Bloomrest</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.1);
            max-width: 450px;
            width: 100%;
        }
        .logo {
            text-align: center;
            margin-bottom: 30px;
            font-size: 28px;
            font-weight: bold;
            color: #667eea;
        }
        .form-group {
            margin-bottom: 25px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #333;
        }
        input[type="text"] {
            width: 100%;
            padding: 15px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
            text-transform: uppercase;
            letter-spacing: 2px;
            text-align: center;
            font-weight: bold;
        }
        input[type="text"]:focus {
            outline: none;
            border-color: #667eea;
        }
        .btn {
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
        }
        .error {
            background: #fee;
            color: #c33;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 20px;
            display: none;
        }
        .success {
            background: #efe;
            color: #3c3;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 20px;
            display: none;
        }
        .instructions {
            text-align: center;
            color: #666;
            margin-bottom: 20px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🌸 Bloomrest</div>
        <h2 style="text-align: center; color: #333; margin-bottom: 10px;">Shop Access Verification</h2>
        <p class="instructions">Enter the 6-character verification code sent to your email</p>
        
        <div id="error" class="error"></div>
        <div id="success" class="success"></div>
        
        <form id="verificationForm">
            <div class="form-group">
                <label for="code">Verification Code</label>
                <input type="text" id="code" name="code" maxlength="6" required placeholder="ABC123">
            </div>
            <button type="submit" class="btn">Verify Access</button>
        </form>
    </div>

    <script>
        document.getElementById('verificationForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const code = document.getElementById('code').value.toUpperCase();
            const errorDiv = document.getElementById('error');
            const successDiv = document.getElementById('success');
            
            // Hide previous messages
            errorDiv.style.display = 'none';
            successDiv.style.display = 'none';
            
            try {
                const response = await fetch('/api/users/verify-shop-access', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ code })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    successDiv.textContent = data.message;
                    successDiv.style.display = 'block';
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    errorDiv.textContent = data.message;
                    errorDiv.style.display = 'block';
                }
            } catch (error) {
                errorDiv.textContent = 'Verification failed. Please try again.';
                errorDiv.style.display = 'block';
            }
        });
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

/* =========================
   VERIFY SHOP ACCESS
========================= */
router.post("/verify-shop-access", async (req, res) => {
  try {
    const { code } = req.body;
    
    // Find user by verification token
    const user = await User.findOne({ verificationToken: code });
    
    if (!user) {
      return res.status(400).json({ message: "Invalid verification code" });
    }
    
    // Mark user as verified and accept terms
    user.verified = true;
    user.verificationToken = null;
    user.termsAndConditionsAccepted = true;
    await user.save();
    
    res.json({ 
      message: "Shop access verified successfully! You can now login.",
      redirect: '/login'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
