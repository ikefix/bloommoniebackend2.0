// Beautiful Email Templates with Blue Color Scheme

export const emailTemplates = {
  // Shop Invitation Template
  shopInvitation: (name, invitationLink, shopName) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Shop Access Invitation - Bloomrest</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f0f8ff;
                color: #1e3a8a;
            }
            .container {
                max-width: 600px;
                margin: 40px auto;
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #3b82f6;
                margin-bottom: 10px;
            }
            .title {
                color: #1e3a8a;
                font-size: 24px;
                margin-bottom: 20px;
            }
            .invitation-box {
                background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
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
                color: #3b82f6;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 15px 10px;
                transition: transform 0.2s;
            }
            .btn-primary {
                background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
                color: white;
            }
            .btn:hover {
                transform: translateY(-2px);
            }
            .divider {
                text-align: center;
                margin: 20px 0;
                color: #64748b;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                color: #64748b;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🌸 Bloomrest</div>
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
  shopVerification: (name, verificationCode, verificationLink, shopName) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Shop Access Verification - Bloomrest</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f0f8ff;
                color: #1e3a8a;
            }
            .container {
                max-width: 600px;
                margin: 40px auto;
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #3b82f6;
                margin-bottom: 10px;
            }
            .title {
                color: #1e3a8a;
                font-size: 24px;
                margin-bottom: 20px;
            }
            .code-box {
                background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
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
                background: #eff6ff;
                border-left: 4px solid #3b82f6;
                padding: 20px;
                margin: 20px 0;
                border-radius: 0 8px 8px 0;
            }
            .btn {
                display: inline-block;
                background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
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
                color: #64748b;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🌸 Bloomrest</div>
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
            </div>
            
            <div class="footer">
                <p>This invitation will expire in 24 hours.</p>
                <p>If you didn't expect this invitation, please ignore this email.</p>
            </div>
        </div>
    </body>
    </html>
  `,

  // Email Verification Template
  emailVerification: (name, verificationLink) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Bloomrest Account</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f0f8ff;
                color: #1e3a8a;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                padding: 40px 20px;
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(59, 130, 246, 0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 10px;
            }
            .tagline {
                color: #64748b;
                font-size: 14px;
            }
            .content {
                background: white;
                padding: 40px;
                border-radius: 15px;
                box-shadow: 0 10px 25px rgba(59, 130, 246, 0.05);
            }
            .welcome {
                font-size: 24px;
                color: #1e40af;
                margin-bottom: 20px;
                font-weight: 600;
            }
            .message {
                color: #475569;
                line-height: 1.6;
                margin-bottom: 30px;
            }
            .verify-button {
                display: inline-block;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: white;
                padding: 15px 40px;
                text-decoration: none;
                border-radius: 50px;
                font-weight: 600;
                font-size: 16px;
                box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
                transition: all 0.3s ease;
                margin: 20px 0;
            }
            .verify-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 15px 35px rgba(59, 130, 246, 0.4);
            }
            .security-note {
                background: #eff6ff;
                border-left: 4px solid #3b82f6;
                padding: 20px;
                margin: 30px 0;
                border-radius: 8px;
                color: #1e40af;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                color: #64748b;
                font-size: 14px;
            }
            .social-links {
                margin-top: 20px;
            }
            .social-links a {
                margin: 0 10px;
                color: #3b82f6;
                text-decoration: none;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🌸 Bloomrest</div>
                <div class="tagline">Your Complete Business Management Solution</div>
            </div>
            
            <div class="content">
                <div class="welcome">Welcome to Bloomrest, ${name}! 👋</div>
                
                <div class="message">
                    Thank you for registering with Bloomrest! We're excited to have you join our community of business owners and managers.
                </div>
                
                <div class="message">
                    To complete your registration and activate your account, please click the verification button below:
                </div>
                
                <div style="text-align: center;">
                    <a href="${verificationLink}" class="verify-button">
                        ✨ Verify My Account
                    </a>
                </div>
                
                <div class="security-note">
                    <strong>🔒 Security Notice:</strong> This verification link will expire in 24 hours. If you didn't create an account with Bloomrest, please ignore this email.
                </div>
                
                <div class="message">
                    Need help? Contact our support team at <a href="mailto:support@bloomrest.com" style="color: #3b82f6;">support@bloomrest.com</a>
                </div>
            </div>
            
            <div class="footer">
                <div>© 2024 Bloomrest. All rights reserved.</div>
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
  passwordReset: (name, resetLink) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Bloomrest Password</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f0f8ff;
                color: #1e3a8a;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                padding: 40px 20px;
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(59, 130, 246, 0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 10px;
            }
            .tagline {
                color: #64748b;
                font-size: 14px;
            }
            .content {
                background: white;
                padding: 40px;
                border-radius: 15px;
                box-shadow: 0 10px 25px rgba(59, 130, 246, 0.05);
            }
            .title {
                font-size: 24px;
                color: #1e40af;
                margin-bottom: 20px;
                font-weight: 600;
            }
            .message {
                color: #475569;
                line-height: 1.6;
                margin-bottom: 30px;
            }
            .reset-button {
                display: inline-block;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: white;
                padding: 15px 40px;
                text-decoration: none;
                border-radius: 50px;
                font-weight: 600;
                font-size: 16px;
                box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
                transition: all 0.3s ease;
                margin: 20px 0;
            }
            .reset-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 15px 35px rgba(59, 130, 246, 0.4);
            }
            .security-note {
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 20px;
                margin: 30px 0;
                border-radius: 8px;
                color: #92400e;
            }
            .expiry-note {
                background: #fee2e2;
                border-left: 4px solid #ef4444;
                padding: 20px;
                margin: 30px 0;
                border-radius: 8px;
                color: #991b1b;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                color: #64748b;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🔐 Bloomrest</div>
                <div class="tagline">Secure Business Management</div>
            </div>
            
            <div class="content">
                <div class="title">Password Reset Request 🔑</div>
                
                <div class="message">
                    Hi ${name}, we received a request to reset your Bloomrest account password.
                </div>
                
                <div class="message">
                    If you made this request, please click the button below to reset your password:
                </div>
                
                <div style="text-align: center;">
                    <a href="${resetLink}" class="reset-button">
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
                    For your safety, make sure your new password is strong and unique to your Bloomrest account.
                </div>
            </div>
            
            <div class="footer">
                <div>© 2024 Bloomrest. Keeping your business secure.</div>
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
                background-color: #f0f8ff;
                color: #1e3a8a;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                padding: 40px 20px;
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(59, 130, 246, 0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 10px;
            }
            .tagline {
                color: #64748b;
                font-size: 14px;
            }
            .content {
                background: white;
                padding: 40px;
                border-radius: 15px;
                box-shadow: 0 10px 25px rgba(59, 130, 246, 0.05);
            }
            .success-icon {
                font-size: 60px;
                text-align: center;
                margin-bottom: 20px;
            }
            .title {
                font-size: 24px;
                color: #059669;
                margin-bottom: 20px;
                font-weight: 600;
                text-align: center;
            }
            .message {
                color: #475569;
                line-height: 1.6;
                margin-bottom: 30px;
            }
            .success-box {
                background: #d1fae5;
                border-left: 4px solid #10b981;
                padding: 20px;
                margin: 30px 0;
                border-radius: 8px;
                color: #065f46;
            }
            .security-tips {
                background: #eff6ff;
                border-left: 4px solid #3b82f6;
                padding: 20px;
                margin: 30px 0;
                border-radius: 8px;
                color: #1e40af;
            }
            .login-button {
                display: inline-block;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                padding: 15px 40px;
                text-decoration: none;
                border-radius: 50px;
                font-weight: 600;
                font-size: 16px;
                box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
                transition: all 0.3s ease;
                margin: 20px 0;
            }
            .login-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 15px 35px rgba(16, 185, 129, 0.4);
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                color: #64748b;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">✅ Bloomrest</div>
                <div class="tagline">Your Password Has Been Reset</div>
            </div>
            
            <div class="content">
                <div class="success-icon">🎉</div>
                <div class="title">Password Reset Successful!</div>
                
                <div class="message">
                    Hi ${name}, your Bloomrest account password has been successfully reset.
                </div>
                
                <div class="success-box">
                    <strong>✨ What's Next?</strong><br>
                    You can now log in to your account using your new password. Your account is secure and ready to use.
                </div>
                
                <div style="text-align: center;">
                    <a href="${process.env.APP_LOGIN_URL || '#'}" class="login-button">
                        🚀 Log In to My Account
                    </a>
                </div>
                
                <div class="security-tips">
                    <strong>🔐 Security Tips:</strong><br>
                    • Keep your password private and secure<br>
                    • Use a unique password for Bloomrest<br>
                    • Enable two-factor authentication if available<br>
                    • Regularly review your account activity
                </div>
                
                <div class="message">
                    If you didn't make this change, please contact our support team immediately at <a href="mailto:support@bloomrest.com" style="color: #3b82f6;">support@bloomrest.com</a>
                </div>
            </div>
            
            <div class="footer">
                <div>© 2024 Bloomrest. Your security is our priority.</div>
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
        <title>Welcome to Bloomrest via Google</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f0f8ff;
                color: #1e3a8a;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                padding: 40px 20px;
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(59, 130, 246, 0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 10px;
            }
            .tagline {
                color: #64748b;
                font-size: 14px;
            }
            .content {
                background: white;
                padding: 40px;
                border-radius: 15px;
                box-shadow: 0 10px 25px rgba(59, 130, 246, 0.05);
            }
            .google-badge {
                background: linear-gradient(135deg, #4285f4 0%, #34a853 50%, #fbbc05 75%, #ea4335 100%);
                color: white;
                padding: 15px 30px;
                border-radius: 50px;
                display: inline-block;
                margin-bottom: 30px;
                font-weight: 600;
                box-shadow: 0 10px 25px rgba(66, 133, 244, 0.3);
            }
            .title {
                font-size: 24px;
                color: #1e40af;
                margin-bottom: 20px;
                font-weight: 600;
            }
            .message {
                color: #475569;
                line-height: 1.6;
                margin-bottom: 30px;
            }
            .feature-list {
                background: #eff6ff;
                padding: 25px;
                border-radius: 12px;
                margin: 30px 0;
            }
            .feature-item {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
                color: #1e40af;
            }
            .feature-icon {
                font-size: 20px;
                margin-right: 15px;
            }
            .dashboard-button {
                display: inline-block;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: white;
                padding: 15px 40px;
                text-decoration: none;
                border-radius: 50px;
                font-weight: 600;
                font-size: 16px;
                box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
                transition: all 0.3s ease;
                margin: 20px 0;
            }
            .dashboard-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 15px 35px rgba(59, 130, 246, 0.4);
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                color: #64748b;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🌸 Bloomrest</div>
                <div class="tagline">Powered by Google Authentication</div>
            </div>
            
            <div class="content">
                <div class="google-badge">🔐 Connected with Google</div>
                
                <div class="title">Welcome to Bloomrest, ${name}! 🎉</div>
                
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
                    <a href="${process.env.APP_DASHBOARD_URL || '#'}" class="dashboard-button">
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
                <div>© 2024 Bloomrest. Your Business, Simplified.</div>
            </div>
        </div>
    </body>
    </html>
  `
};

export default emailTemplates;
