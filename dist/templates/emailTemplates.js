export const emailTemplates = {
    // Shop Invitation Template
    shopInvitation: (name, invitationLink, shopName) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Shop Access Invitation - Bloommonie</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: white;
                color: #1e3a8a;
            }
            .container {
                max-width: 600px;
                margin: 40px auto;
                background: white;
                padding: 40px;
                border-radius: 12px;
                border: 1px solid #1e3a8a;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #1e3a8a;
                margin-bottom: 10px;
            }
            .title {
                color: #1e3a8a;
                font-size: 24px;
                margin-bottom: 20px;
            }
            .invitation-box {
                background: #1e3a8a;
                color: white;
                padding: 30px;
                border-radius: 12px;
                text-align: center;
                margin: 30px 0;
            }
            .shop-name {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 15px;
            }
            .btn {
                display: inline-block;
                background: white;
                color: #1e3a8a;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 15px 10px;
            }
            .btn-primary {
                background: #1e3a8a;
                color: white;
            }
            .btn:hover {
                background: #1e3a8a;
            }
            .divider {
                text-align: center;
                margin: 20px 0;
                color: #1e3a8a;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                color: #1e3a8a;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🌸 Bloommonie</div>
                <h1 class="title">Shop Access Invitation</h1>
            </div>
            
            <p>Hi <strong>${name}</strong>,</p>
            
            <p>You have been invited to join <strong>${shopName}</strong> as a team member!</p>
            
            <div class="invitation-box">
                <div class="shop-name">${shopName}</div>
                <p>Choose how you'd like to join:</p>
                
                <div style="margin-top: 20px;">
                    <a href="${invitationLink}" class="btn btn-primary">Create Account</a>
                    <a href="/api/users/google" class="btn">Sign up with Google</a>
                </div>
            </div>
            
            <div class="divider">OR</div>
            
            <p style="text-align: center;">
                <strong>Option 1:</strong> Click "Create Account" to set up your password<br>
                <strong>Option 2:</strong> Click "Sign up with Google" for quick access
            </p>
            
            <div class="footer">
                <p>This invitation will expire in 7 days.</p>
                <p>If you didn't expect this invitation, please ignore this email.</p>
            </div>
        </div>
    </body>
    </html>
  `,
    // Shop Verification Template
    shopVerification: (name, verificationCode, verificationLink, shopName, deepLink) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Shop Access Verification - Bloommonie</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: white;
                color: #1e3a8a;
            }
            .container {
                max-width: 600px;
                margin: 40px auto;
                background: white;
                padding: 40px;
                border-radius: 12px;
                border: 1px solid #1e3a8a;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #1e3a8a;
                margin-bottom: 10px;
            }
            .title {
                color: #1e3a8a;
                font-size: 24px;
                margin-bottom: 20px;
            }
            .code-box {
                background: #1e3a8a;
                color: white;
                font-size: 28px;
                font-weight: bold;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
                letter-spacing: 3px;
                margin: 30px 0;
                text-transform: uppercase;
            }
            .info {
                background: white;
                border-left: 4px solid #1e3a8a;
                padding: 20px;
                margin: 20px 0;
                border-radius: 0 8px 8px 0;
            }
            .btn {
                display: inline-block;
                background: #1e3a8a;
                color: white;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin-top: 20px;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                color: #1e3a8a;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🌸 Bloommonie</div>
                <h1 class="title">Shop Access Invitation</h1>
            </div>
            
            <p>Hi <strong>${name}</strong>,</p>
            
            <p>You have been invited to join <strong>${shopName}</strong> as a team member!</p>
            
            <div class="code-box">
                ${verificationCode}
            </div>
            
            <div class="info">
                <strong>Important:</strong> Keep this verification code secure. You will need it to activate your account.
            </div>
            
            <p>Click the button below to verify your access:</p>
            
            <div style="text-align: center;">
                <a href="${verificationLink}" class="btn">Verify Shop Access</a>
                ${deepLink ? `<br><br><a href="${process.env.APP_BASE_URL || ''}/api/users/open-in-app?link=${encodeURIComponent(deepLink)}" class="btn" style="background: #10b981; margin-top: 10px;">Open in App</a>` : ''}
            </div>
            
            <div class="footer">
                <p>This invitation will expire in 24 hours.</p>
                <p>If you didn't expect this invitation, please ignore this email.</p>
            </div>
        </div>
    </body>
    </html>
  `,
    // Email Verification Template (OTP)
    emailVerification: (name, otp) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Bloommonie Account</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: white;
                color: #1e3a8a;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                padding: 40px 20px;
                border-radius: 20px;
                border: 1px solid #1e3a8a;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #1e3a8a;
                margin-bottom: 10px;
            }
            .tagline {
                color: #1e3a8a;
                font-size: 14px;
            }
            .content {
                background: white;
                padding: 40px;
                border-radius: 15px;
                border: 1px solid #1e3a8a;
            }
            .welcome {
                font-size: 24px;
                color: #1e3a8a;
                margin-bottom: 20px;
                font-weight: 600;
            }
            .message {
                color: #1e3a8a;
                line-height: 1.6;
                margin-bottom: 30px;
            }
            .otp-box {
                background: #1e3a8a;
                color: white;
                font-size: 36px;
                font-weight: bold;
                padding: 25px;
                border-radius: 12px;
                text-align: center;
                letter-spacing: 8px;
                margin: 30px 0;
                text-transform: uppercase;
            }
            .security-note {
                background: white;
                border-left: 4px solid #1e3a8a;
                padding: 20px;
                margin: 30px 0;
                border-radius: 8px;
                color: #1e3a8a;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                color: #1e3a8a;
                font-size: 14px;
            }
            .social-links {
                margin-top: 20px;
            }
            .social-links a {
                margin: 0 10px;
                color: #1e3a8a;
                text-decoration: none;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🌸 Bloommonie</div>
                <div class="tagline">Your Complete Business Management Solution</div>
            </div>
            
            <div class="content">
                <div class="welcome">Welcome to Bloommonie, ${name}! 👋</div>
                
                <div class="message">
                    Thank you for registering with Bloommonie! We're excited to have you join our community of business owners and managers.
                </div>
                
                <div class="message">
                    To complete your registration and activate your account, please use the following verification code:
                </div>
                
                <div class="otp-box">
                    ${otp}
                </div>
                
                <div class="message">
                    Enter this code on the verification page to complete your account setup.
                </div>
                
                <div class="security-note">
                    <strong>🔒 Security Notice:</strong> This verification code will expire in 10 minutes. If you didn't create an account with Bloommonie, please ignore this email.
                </div>
                
                <div class="message">
                    Need help? Contact our support team at <a href="mailto:support@Bloommonie.com" style="color: #3b82f6;">support@Bloommonie.com</a>
                </div>
            </div>
            
            <div class="footer">
                <div>© 2024 Bloommonie. All rights reserved.</div>
                <div class="social-links">
                    <a href="#">📧</a>
                    <a href="#">📱</a>
                    <a href="#">💬</a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `,
    // Password Reset Template
    passwordReset: (name, resetLink, deepLink) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Bloommonie Password</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: white;
                color: #1e3a8a;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                padding: 40px 20px;
                border-radius: 20px;
                border: 1px solid #1e3a8a;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #1e3a8a;
                margin-bottom: 10px;
            }
            .tagline {
                color: #1e3a8a;
                font-size: 14px;
            }
            .content {
                background: white;
                padding: 40px;
                border-radius: 15px;
                border: 1px solid #1e3a8a;
            }
            .title {
                font-size: 24px;
                color: #1e3a8a;
                margin-bottom: 20px;
                font-weight: 600;
            }
            .message {
                color: #1e3a8a;
                line-height: 1.6;
                margin-bottom: 30px;
            }
            .reset-button {
                display: inline-block;
                background: #1e3a8a;
                color: white;
                padding: 15px 40px;
                text-decoration: none;
                border-radius: 50px;
                font-weight: 600;
                font-size: 16px;
                margin: 20px 0;
            }
            .reset-button:hover {
                background: #1e3a8a;
            }
            .security-note {
                background: white;
                border-left: 4px solid #10b981;
                padding: 20px;
                margin: 30px 0;
                border-radius: 8px;
                color: #1e3a8a;
            }
            .expiry-note {
                background: white;
                border-left: 4px solid #10b981;
                padding: 20px;
                margin: 30px 0;
                border-radius: 8px;
                color: #1e3a8a;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                color: #1e3a8a;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🔐 Bloommonie</div>
                <div class="tagline">Secure Business Management</div>
            </div>
            
            <div class="content">
                <div class="title">Password Reset Request 🔑</div>
                
                <div class="message">
                    Hi ${name}, we received a request to reset your Bloommonie account password.
                </div>
                
                <div class="message">
                    If you made this request, please click the button below to reset your password:
                </div>
                
                <div style="text-align: center;">
                    <a href="${process.env.APP_BASE_URL || ''}/api/users/open-in-app?link=${encodeURIComponent(deepLink)}" class="reset-button">
                        🔄 Reset My Password
                    </a>
                </div>
                
                <div class="expiry-note">
                    <strong>⏰ Time Sensitive:</strong> This reset link will expire in 10 minutes for your security.
                </div>
                
                <div class="security-note">
                    <strong>🛡️ Security Alert:</strong> If you didn't request this password reset, please secure your account immediately and contact our support team.
                </div>
                
                <div class="message">
                    For your safety, make sure your new password is strong and unique to your Bloommonie account.
                </div>
            </div>
            
            <div class="footer">
                <div>© 2024 Bloommonie. Keeping your business secure.</div>
            </div>
        </div>
    </body>
    </html>
  `,
    // Password Reset Confirmation Template
    passwordResetConfirmation: (name) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Successful</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: white;
                color: #1e3a8a;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                padding: 40px 20px;
                border-radius: 20px;
                border: 1px solid #1e3a8a;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #1e3a8a;
                margin-bottom: 10px;
            }
            .tagline {
                color: #1e3a8a;
                font-size: 14px;
            }
            .content {
                background: white;
                padding: 40px;
                border-radius: 15px;
                border: 1px solid #1e3a8a;
            }
            .success-icon {
                font-size: 60px;
                text-align: center;
                margin-bottom: 20px;
            }
            .title {
                font-size: 24px;
                color: #10b981;
                margin-bottom: 20px;
                font-weight: 600;
                text-align: center;
            }
            .message {
                color: #1e3a8a;
                line-height: 1.6;
                margin-bottom: 30px;
            }
            .success-box {
                background: white;
                border-left: 4px solid #10b981;
                padding: 20px;
                margin: 30px 0;
                border-radius: 8px;
                color: #1e3a8a;
            }
            .security-tips {
                background: white;
                border-left: 4px solid #1e3a8a;
                padding: 20px;
                margin: 30px 0;
                border-radius: 8px;
                color: #1e3a8a;
            }
            .login-button {
                display: inline-block;
                background: #10b981;
                color: white;
                padding: 15px 40px;
                text-decoration: none;
                border-radius: 50px;
                font-weight: 600;
                font-size: 16px;
                margin: 20px 0;
            }
            .login-button:hover {
                background: #10b981;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                color: #1e3a8a;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">✅ Bloommonie</div>
                <div class="tagline">Your Password Has Been Reset</div>
            </div>
            
            <div class="content">
                <div class="success-icon">🎉</div>
                <div class="title">Password Reset Successful!</div>
                
                <div class="message">
                    Hi ${name}, your Bloommonie account password has been successfully reset.
                </div>
                
                <div class="success-box">
                    <strong>✨ What's Next?</strong><br>
                    You can now log in to your account using your new password. Your account is secure and ready to use.
                </div>
                
                <div style="text-align: center;">
                    <a href="${process.env.APP_DEEP_LINK_SCHEME ? `${process.env.APP_DEEP_LINK_SCHEME}://login` : (process.env.APP_LOGIN_URL || '#')}" class="login-button">
                        🚀 Log In to My Account
                    </a>
                </div>
                
                <div class="security-tips">
                    <strong>🔐 Security Tips:</strong><br>
                    • Keep your password private and secure<br>
                    • Use a unique password for Bloommonie<br>
                    • Enable two-factor authentication if available<br>
                    • Regularly review your account activity
                </div>
                
                <div class="message">
                    If you didn't make this change, please contact our support team immediately at <a href="mailto:support@Bloommonie.com" style="color: #3b82f6;">support@Bloommonie.com</a>
                </div>
            </div>
            
            <div class="footer">
                <div>© 2024 Bloommonie. Your security is our priority.</div>
            </div>
        </div>
    </body>
    </html>
  `,
    // Google Welcome Template
    googleWelcome: (name) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Bloommonie via Google</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: white;
                color: #1e3a8a;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                padding: 40px 20px;
                border-radius: 20px;
                border: 1px solid #1e3a8a;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #1e3a8a;
                margin-bottom: 10px;
            }
            .tagline {
                color: #1e3a8a;
                font-size: 14px;
            }
            .content {
                background: white;
                padding: 40px;
                border-radius: 15px;
                border: 1px solid #1e3a8a;
            }
            .google-badge {
                background: #1e3a8a;
                color: white;
                padding: 15px 30px;
                border-radius: 50px;
                display: inline-block;
                margin-bottom: 30px;
                font-weight: 600;
            }
            .title {
                font-size: 24px;
                color: #1e3a8a;
                margin-bottom: 20px;
                font-weight: 600;
            }
            .message {
                color: #1e3a8a;
                line-height: 1.6;
                margin-bottom: 30px;
            }
            .feature-list {
                background: white;
                padding: 25px;
                border-radius: 12px;
                margin: 30px 0;
            }
            .feature-item {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
                color: #1e3a8a;
            }
            .feature-icon {
                font-size: 20px;
                margin-right: 15px;
            }
            .dashboard-button {
                display: inline-block;
                background: #1e3a8a;
                color: white;
                padding: 15px 40px;
                text-decoration: none;
                border-radius: 50px;
                font-weight: 600;
                font-size: 16px;
                margin: 20px 0;
            }
            .dashboard-button:hover {
                background: #1e3a8a;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                color: #1e3a8a;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🌸 Bloommonie</div>
                <div class="tagline">Powered by Google Authentication</div>
            </div>
            
            <div class="content">
                <div class="google-badge">🔐 Connected with Google</div>
                
                <div class="title">Welcome to Bloommonie, ${name}! 🎉</div>
                
                <div class="message">
                    Your account has been successfully created and verified through Google authentication. You're all set to start managing your business like never before!
                </div>
                
                <div class="feature-list">
                    <div class="feature-item">
                        <span class="feature-icon">📊</span>
                        <span>Complete Business Analytics & Reports</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">📦</span>
                        <span>Advanced Inventory Management</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">💰</span>
                        <span>Secure Payment Processing</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">👥</span>
                        <span>Staff Management & Performance Tracking</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">🏪</span>
                        <span>Multi-Shop Operations Support</span>
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <a href="${process.env.APP_DEEP_LINK_SCHEME ? `${process.env.APP_DEEP_LINK_SCHEME}://dashboard` : (process.env.APP_DASHBOARD_URL || '#')}" class="dashboard-button">
                        🚀 Go to Dashboard
                    </a>
                </div>
                
                <div class="message">
                    <strong>🎯 Next Steps:</strong><br>
                    • Complete your business profile<br>
                    • Set up your first shop/location<br>
                    • Add your products and services<br>
                    • Invite your team members
                </div>
            </div>
            
            <div class="footer">
                <div>© 2024 Bloommonie. Your Business, Simplified.</div>
            </div>
        </div>
    </body>
    </html>
  `
};
export default emailTemplates;
