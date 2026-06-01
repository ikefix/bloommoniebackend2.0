import { Router } from "express";
import User from "../models/user.js";
import Shop from "../models/shop.js";
import auth from "../middlewares/auth.js";
import bcrypt from "bcryptjs";
import { emailQueue } from "../queues/index.js";
const router = Router();
/* =========================
   ADD CASHIER/SELLER TO SHOP
========================= */
router.post("/add-cashier", auth, async (req, res) => {
    try {
        const { shopId } = req.body;
        // Find shop - either by provided shopId or by createdBy (fallback)
        let shop;
        if (shopId) {
            shop = await Shop.findOne({ _id: shopId });
        }
        else {
            shop = await Shop.findOne({ createdBy: req.user.id });
        }
        if (!shop) {
            return res.status(403).json({ message: "Shop not found or you don't have permission" });
        }
        // Initialize allowedUsers array if it doesn't exist
        if (!shop.allowedUsers || !Array.isArray(shop.allowedUsers)) {
            shop.allowedUsers = [];
        }
        // Handle both single user and array of users
        const usersToAdd = Array.isArray(req.body) ? req.body : [req.body];
        const results = [];
        let shopUpdated = false;
        for (const userData of usersToAdd) {
            const { email, name, role = "cashier" } = userData;
            if (!email || !name) {
                results.push({
                    email: email || 'unknown',
                    status: 'error',
                    message: 'Email and name are required'
                });
                continue;
            }
            // Check if user already exists
            let existingUser = await User.findOne({ email });
            if (existingUser) {
                // Add user to shop's allowed users if not already added
                if (!shop.allowedUsers.includes(existingUser._id)) {
                    shop.allowedUsers.push(existingUser._id);
                    shopUpdated = true;
                    results.push({
                        email,
                        status: 'success',
                        message: 'Existing user added to shop successfully',
                        user: {
                            id: existingUser._id,
                            name: existingUser.name,
                            email: existingUser.email,
                            role: existingUser.role
                        }
                    });
                }
                else {
                    results.push({
                        email,
                        status: 'error',
                        message: 'User is already a member of this shop'
                    });
                }
            }
            else {
                // User doesn't exist - generate OTP and create account
                const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                // Create new cashier/seller account with OTP as temporary password
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
                shopUpdated = true;
                // Build links for email
                // verificationLink is always HTTPS (email clients block custom URL schemes)
                // deepLink is the mobile deep link shown as a secondary "Open in App" button
                const scheme = process.env.APP_DEEP_LINK_SCHEME || 'bloomonie';
                const deepLink = `${scheme}://shop-verification?code=${verificationCode}`;
                const verificationLink = `${process.env.APP_BASE_URL}/api/shop-verification-page/shop-verification-page`;
                await emailQueue.add('send-verification', {
                    email,
                    name,
                    verificationCode,
                    verificationLink,
                    deepLink,
                    webLink: verificationLink,
                    shopName: shop.name || shop.name
                });
                results.push({
                    email,
                    status: 'success',
                    message: 'Cashier/Seller added successfully. Verification email sent.',
                    user: {
                        id: newUser._id,
                        name: newUser.name,
                        email: newUser.email,
                        role: newUser.role
                    }
                });
            }
        }
        // Save shop if it was updated
        if (shopUpdated) {
            await shop.save();
            console.log(`Shop ${shop._id} updated with ${shop.allowedUsers.length} allowed users`);
        }
        // Return appropriate response based on input
        if (Array.isArray(req.body)) {
            const successCount = results.filter(r => r.status === 'success').length;
            const errorCount = results.filter(r => r.status === 'error').length;
            res.status(errorCount === 0 ? 201 : 207).json({
                message: `Processed ${usersToAdd.length} users. ${successCount} successful, ${errorCount} failed.`,
                results,
                summary: {
                    total: usersToAdd.length,
                    successful: successCount,
                    failed: errorCount
                }
            });
        }
        else {
            // Single user - return first result
            const firstResult = results[0];
            res.status(firstResult.status === 'success' ? 201 : 400).json({
                message: firstResult.message,
                user: firstResult.user
            });
        }
    }
    catch (err) {
        console.error('Error adding cashier to shop:', err);
        res.status(500).json({ message: "Server error", error: err.message });
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
    <title>Shop Verification - Bloomonie</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
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
            max-width: 450px;
            width: 100%;
        }
        .logo {
            text-align: center;
            margin-bottom: 30px;
            font-size: 28px;
            font-weight: bold;
            color: #2c5c94;
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
        input[type="text"],
        input[type="password"] {
            width: 100%;
            padding: 15px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input[type="text"] {
            text-transform: uppercase;
            letter-spacing: 2px;
            text-align: center;
            font-weight: bold;
        }
        input[type="text"]:focus,
        input[type="password"]:focus {
            outline: none;
            border-color: #2c5c94;
        }
        .btn {
            width: 100%;
            padding: 15px;
            background: #2c5c94;
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
        <div class="logo">Bloomonie</div>
        <h2 style="text-align: center; color: #333; margin-bottom: 10px;">Shop Access Verification</h2>
        
        <div id="error" class="error"></div>
        <div id="success" class="success"></div>
        
        <form id="verificationForm">
            <div class="form-group">
                <label for="code">Verification Code</label>
                <input type="text" id="code" name="code" maxlength="6" required placeholder="ABC123">
            </div>
            <div class="form-group">
                <label for="password">Set Your Password</label>
                <input type="password" id="password" name="password" required placeholder="Enter your password" minlength="6">
            </div>
            <button type="submit" class="btn">Verify Access</button>
        </form>
        
        <div id="downloadSection" style="display: none; text-align: center; margin-top: 20px;">
            <h3 style="color: #333; margin-bottom: 15px;">Verification Successful!</h3>
            <p style="color: #666; margin-bottom: 20px;">Your account has been activated.</p>
            <a id="deepLinkBtn" href="#" class="btn" style="display: none; text-decoration: none;">Open in Bloommonie</a>
            <a id="downloadLink" href="#" class="btn" style="display: inline-block; text-decoration: none;">Download Desktop App</a>
        </div>
    </div>

    <script>
        // Prevent navigation away from page before verification is complete
        window.addEventListener('beforeunload', (e) => {
            const downloadSection = document.getElementById('downloadSection');
            if (downloadSection.style.display === 'none') {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        });

        // Prevent back button navigation
        history.pushState(null, null, document.URL);
        window.addEventListener('popstate', (e) => {
            const downloadSection = document.getElementById('downloadSection');
            if (downloadSection.style.display === 'none') {
                e.preventDefault();
                history.pushState(null, null, document.URL);
            }
        });

        document.getElementById('verificationForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const code = document.getElementById('code').value.toUpperCase();
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('error');
            const successDiv = document.getElementById('success');
            const downloadSection = document.getElementById('downloadSection');
            const verificationForm = document.getElementById('verificationForm');
            
            // Hide previous messages
            errorDiv.style.display = 'none';
            successDiv.style.display = 'none';
            downloadSection.style.display = 'none';
            
            try {
                const response = await fetch('/api/shop-verification-page/verify-shop-access', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ code, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Set the download link from the response
                    if (data.downloadUrl) {
                        document.getElementById('downloadLink').href = data.downloadUrl;
                    }
                    
                    // Check if app is installed and show appropriate button
                    const scheme = 'bloommonie';
                    const deepLinkUrl = scheme + '://shop-verification?code=' + code;
                    
                    // Try to detect if the app is installed by attempting to open the deep link
                    // If it fails, show the download button instead
                    const deepLinkBtn = document.getElementById('deepLinkBtn');
                    const downloadLink = document.getElementById('downloadLink');
                    
                    // Show deep link button by default, download link as fallback
                    deepLinkBtn.href = deepLinkUrl;
                    deepLinkBtn.style.display = 'inline-block';
                    
                    // Set a timeout to show download button if deep link doesn't work
                    setTimeout(function() {
                        // If the user hasn't navigated away, show download button
                        if (document.visibilityState === 'visible') {
                            deepLinkBtn.style.display = 'none';
                            downloadLink.style.display = 'inline-block';
                        }
                    }, 2000);
                    
                    verificationForm.style.display = 'none';
                    downloadSection.style.display = 'block';
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
        const { code, password } = req.body;
        // Find user by verification token
        const user = await User.findOne({ verificationToken: code });
        if (!user) {
            return res.status(400).json({ message: "Invalid verification code" });
        }
        // Hash the new password if provided
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            user.password = hashedPassword;
        }
        // Mark user as verified and accept terms
        user.verified = true;
        user.verificationToken = null;
        user.termsAndConditionsAccepted = true;
        await user.save();
        res.json({
            message: "Shop access verified successfully! Your account is now active.",
            downloadUrl: process.env.DESKTOP_APP_DOWNLOAD_URL || '#'
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
export default router;
