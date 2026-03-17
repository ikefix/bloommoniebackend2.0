# Complete Fintech API Documentation

## 🏦 Professional Fintech System

Your savings system has been transformed into a **bank-level fintech platform** with double-entry accounting, virtual bank accounts, fraud prevention, and professional savings management.

## 📊 API Endpoints Overview

### Base URL
```
http://localhost:5000/api
```

### Authentication
All endpoints require authentication token in headers:
```
Authorization: Bearer <token>
```

## 🚀 Core API Modules

### 1. User Management (`/api/users`)
- `POST /register` - Register new user
- `POST /login` - User login
- `POST /send-otp` - Send OTP verification
- `POST /verify-otp` - Verify OTP
- `GET /` - Get all users (admin)
- `POST /create-user` - Admin create user

### 2. Wallet System (`/api/wallet-v2`)
- `GET /balance` - Get wallet balance
- `GET /summary` - Get wallet summary
- `POST /add-money` - Manual wallet funding
- `POST /withdraw` - Withdraw to bank account
- `POST /transfer` - Transfer to another user
- `GET /transactions` - Transaction history
- `POST /create-recipient` - Create transfer recipient
- `GET /banks` - Get banks list
- `POST /resolve-account` - Resolve bank account
- `POST /lock-funds` - Lock funds
- `POST /unlock-funds` - Unlock funds

### 3. Virtual Bank Accounts (`/api/virtual-account`)
- `POST /create` - Create virtual account
- `GET /` - Get user's virtual account
- `PUT /restrictions` - Update account restrictions
- `DELETE /deactivate` - Deactivate account
- `POST /webhook` - Payment webhook
- `GET /transactions` - Virtual account transactions

### 4. Payment Processing (`/api/payment-v2`)
- `POST /initialize` - Initialize payment
- `POST /verify/:reference` - Verify payment
- `GET /status/:reference` - Check transaction status
- `GET /methods` - Get payment methods
- `GET /history` - Payment history
- `POST /webhook` - Payment webhook
- `GET /stats` - Payment statistics

### 5. Professional Savings (`/api/savings`)
- `POST /create` - Create savings plan
- `GET /` - Get user's savings plans
- `GET /:id` - Get savings plan details
- `POST /:id/contribute` - Add contribution
- `POST /:id/withdraw` - Request withdrawal
- `GET /:id/transactions` - Savings transactions
- `PUT /:id` - Update savings plan
- `POST /:id/close` - Close savings plan
- `GET /stats/overview` - Savings statistics

## 🔐 Security Features

### Fraud Prevention
- Risk scoring (0-100)
- IP/device tracking
- Transaction monitoring
- Velocity limits
- Automatic blocking

### Transaction Limits
- Single transaction limits
- Daily transaction limits
- Monthly transaction limits
- Account freezing

### Account Security
- PIN protection
- 2FA support
- Login attempt tracking
- Device management

## 💰 Payment Methods

### 1. Virtual Bank Account (Recommended - No Popup)
```
POST /api/virtual-account/create
{
  "accountName": "John Doe",
  "provider": "paystack"
}
```

**Response:**
```json
{
  "accountNumber": "9988776655",
  "bankName": "Providus Bank",
  "bankCode": "101",
  "provider": "paystack"
}
```

**User Experience:**
- User gets permanent bank account
- Transfers money normally
- Webhook automatically credits wallet
- No popup, no redirect

### 2. Card Payment (Popup)
```
POST /api/payment-v2/initialize
{
  "amount": 5000,
  "description": "Wallet funding",
  "paymentMethod": "card"
}
```

### 3. Bank Transfer
```
POST /api/wallet-v2/withdraw
{
  "amount": 2000,
  "description": "Bank withdrawal",
  "recipientCode": "RCP_123456"
}
```

## 🏦 Professional Savings Features

### Savings Plan Types

#### 1. Fixed Savings
- Locked until maturity date
- Early withdrawal penalties
- Higher interest rates

#### 2. Flexible Savings
- Withdraw anytime
- Lower interest rates
- No penalties

#### 3. Target Savings
- Goal-based savings
- Progress tracking
- Achievement notifications

#### 4. Goal Savings
- Specific objectives
- Timeline tracking
- Milestone rewards

### Create Savings Plan
```
POST /api/savings/create
{
  "name": "Emergency Fund",
  "type": "fixed",
  "targetAmount": 100000,
  "interestRate": 10,
  "maturityDate": "2024-12-31",
  "autoSave": {
    "enabled": true,
    "frequency": "monthly",
    "amount": 10000
  }
}
```

## 📊 Double-Entry Accounting

Every transaction creates balanced ledger entries:

### Example: User deposits ₦5,000

**Credit Entry (User Wallet):**
```json
{
  "accountType": "wallet",
  "debit": 0,
  "credit": 5000,
  "balance": 5000,
  "reference": "DEP_123456",
  "transactionType": "deposit"
}
```

**Debit Entry (Settlement Account):**
```json
{
  "accountType": "settlement",
  "debit": 5000,
  "credit": 0,
  "balance": 0,
  "reference": "DEP_123456",
  "transactionType": "settlement"
}
```

**Total Debits = Total Credits = ₦5,000 ✅**

## 🛡️ Fraud Detection Examples

### Risk Factors
- New IP/device detection
- High amount monitoring
- Rapid transactions
- Failed attempts
- Unusual timing

### Risk Actions
- **0-30**: Allow transaction
- **30-50**: Require OTP
- **50-70**: Manual review
- **70+**: Block transaction

## 📋 Database Schema

### Core Tables
1. **users** - User management with KYC
2. **wallets** - Wallet management with limits
3. **ledger_entries** - Double-entry accounting
4. **virtual_accounts** - Virtual bank accounts
5. **savings_plans** - Professional savings
6. **fraud_detections** - Fraud monitoring
7. **savings** - Legacy savings (migrated)

## 🔄 Migration System

### Legacy to New System
The system automatically migrates old savings to new professional system:

```javascript
// Check migration status
GET /api/savings/migration-status

// Migrate if needed
POST /api/savings/migrate
```

## 📱 Frontend Integration

### Virtual Account Funding Flow
```javascript
// 1. Create virtual account
const virtualAccount = await fetch('/api/virtual-account/create', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ accountName: 'John Doe' })
});

// 2. Display account details to user
showAccountDetails(virtualAccount.data);

// 3. User transfers money to account
// 4. Webhook automatically processes payment
// 5. Real-time balance update
```

### Savings Plan Creation
```javascript
const savingsPlan = await fetch('/api/savings/create', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    name: 'Emergency Fund',
    type: 'fixed',
    targetAmount: 100000,
    maturityDate: '2024-12-31'
  })
});
```

## 🚀 Production Setup

### Environment Variables
```env
# Database
MONGO_DB_CONN=mongodb://localhost:27017/bloommonie

# Paystack
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxx
PAYSTACK_WEBHOOK_SECRET=whsec_xxxxxxxxx
PAYSTACK_CALLBACK_URL=http://yourdomain.com/payment/success

# Security
BLACKLISTED_IPS=192.168.1.1,10.0.0.1
JWT_SECRET=your_jwt_secret

# Application
APP_URL=http://yourdomain.com
NODE_ENV=production
```

### Webhook Configuration
Configure these webhooks in Paystack dashboard:
- `http://yourdomain.com/api/payment-v2/webhook`
- `http://yourdomain.com/api/virtual-account/webhook`

## 📊 Monitoring & Analytics

### Transaction Analytics
```javascript
// Get payment statistics
GET /api/payment-v2/stats

// Get savings overview
GET /api/savings/stats/overview

// Get wallet summary
GET /api/wallet-v2/summary
```

### Fraud Monitoring
```javascript
// Get user risk profile
GET /api/users/:id/risk-profile

// Get fraud alerts
GET /api/admin/fraud-alerts
```

## 🎯 Best Practices

### 1. Always Use Virtual Accounts
- No popup payments
- Better user experience
- Lower fees
- Higher success rates

### 2. Implement Proper Error Handling
- Validate all inputs
- Handle network failures
- Provide user feedback

### 3. Monitor Fraud Detection
- Review high-risk transactions
- Update risk rules regularly
- Monitor blocked attempts

### 4. Use Double-Entry Accounting
- Never update balances directly
- Always create ledger entries
- Maintain audit trails

## 🔧 Testing

### Test Virtual Account Flow
```bash
# 1. Create virtual account
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"accountName": "Test User"}' \
  http://localhost:5000/api/virtual-account/create

# 2. Test bank transfer funding
# Transfer money to the provided account number

# 3. Check wallet balance
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/wallet-v2/balance
```

### Test Savings Plan
```bash
# Create savings plan
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Savings", "type": "flexible"}' \
  http://localhost:5000/api/savings/create

# Add contribution
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000, "description": "Test contribution"}' \
  http://localhost:5000/api/savings/:id/contribute
```

## 📞 Support

This system follows standards used by major fintechs:
- PiggyVest
- Cowrywise
- ALAT by Wema
- Kuda Bank
- Carbon

## 🎉 Ready for Production

Your fintech platform now includes:
- ✅ Bank-level accounting
- ✅ Virtual bank accounts (no popup)
- ✅ Professional savings system
- ✅ Fraud prevention
- ✅ Complete audit trails
- ✅ Production-ready security

The system is **enterprise-grade** and ready for serious fintech operations! 🚀
