# Wallet API Endpoints

## Base URL
`http://localhost:5000/api/wallet`

## Authentication
All endpoints require authentication token in headers:
```
Authorization: Bearer <token>
```

## Environment Variables Required
Add these to your `.env` file:
```
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_WEBHOOK_SECRET=your_paystack_webhook_secret
PAYSTACK_CALLBACK_URL=http://localhost:5000/payment/success
APP_URL=http://localhost:5000
```

## Endpoints

### 1. Get Wallet Balance
**GET** `/balance`

**Response:**
```json
{
  "balance": 1000.00,
  "lastUpdated": "2024-01-01T12:00:00.000Z",
  "isActive": true
}
```

### 2. Add Money to Wallet
**POST** `/add-money`

**Body:**
```json
{
  "amount": 500.00,
  "description": "Initial deposit"
}
```

**Response:**
```json
{
  "message": "Money added successfully",
  "newBalance": 1500.00,
  "transaction": {
    "type": "deposit",
    "amount": 500.00,
    "description": "Initial deposit",
    "balance": 1500.00,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### 3. Withdraw Money to Bank Account
**POST** `/withdraw`

**Body:**
```json
{
  "amount": 200.00,
  "description": "Bank withdrawal",
  "recipientCode": "RCP_123456"
}
```

**Response:**
```json
{
  "message": "Withdrawal initiated successfully",
  "newBalance": 1300.00,
  "transfer": {
    "reference": "transfer_ref_123456",
    "amount": 200.00,
    "description": "Bank withdrawal",
    "recipientCode": "RCP_123456",
    "status": "pending",
    "transferCode": "TRF_123456"
  },
  "transaction": {
    "type": "withdrawal",
    "amount": 200.00,
    "description": "Bank transfer: transfer_ref_123456 - Bank withdrawal",
    "balance": 1300.00,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### 4. Create Transfer Recipient
**POST** `/create-recipient`

**Body:**
```json
{
  "name": "John Doe",
  "accountNumber": "1234567890",
  "bankCode": "044"
}
```

**Response:**
```json
{
  "message": "Transfer recipient created successfully",
  "recipient": {
    "recipient_code": "RCP_123456",
    "type": "nuban",
    "name": "John Doe",
    "description": "John Doe - Access Bank",
    "account_number": "1234567890",
    "bank_name": "Access Bank",
    "bank_code": "044"
  }
}
```

### 5. Get Banks List
**GET** `/banks`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Access Bank",
      "slug": "access-bank",
      "code": "044",
      "longcode": "044150015",
      "gateway": "etranzact",
      "pay_with_bank": true,
      "active": true,
      "is_deleted": false,
      "country": "Nigeria",
      "currency": "NGN",
      "type": "nuban",
      "id": 1
    }
  ]
}
```

### 6. Resolve Bank Account
**POST** `/resolve-account`

**Body:**
```json
{
  "accountNumber": "1234567890",
  "bankCode": "044"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "account_number": "1234567890",
    "account_name": "John Doe",
    "bank_id": 1
  }
}
```

### 7. Transfer Money to Another User
**POST** `/transfer`

**Body:**
```json
{
  "recipientPhone": "+1234567890",
  "amount": 100.00,
  "description": "Payment for services"
}
```

**Response:**
```json
{
  "message": "Transfer successful",
  "senderBalance": 1200.00,
  "recipientName": "John Doe",
  "transaction": {
    "type": "transfer_out",
    "amount": 100.00,
    "description": "Payment for services",
    "toUser": "John Doe",
    "balance": 1200.00,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### 8. Get Transaction History
**GET** `/transactions`

**Query Parameters:**
- `limit` (optional): Number of transactions per page (default: 20)
- `page` (optional): Page number (default: 1)
- `type` (optional): Filter by transaction type (`deposit`, `withdrawal`, `transfer_in`, `transfer_out`)

**Response:**
```json
{
  "transactions": [
    {
      "type": "deposit",
      "amount": 500.00,
      "description": "Initial deposit",
      "balance": 1500.00,
      "timestamp": "2024-01-01T12:00:00.000Z",
      "fromUser": null,
      "toUser": null,
      "fromUserDetails": null,
      "toUserDetails": null
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalCount": 1,
    "limit": 20
  }
}
```

### 9. Get Wallet Summary
**GET** `/summary`

**Response:**
```json
{
  "balance": 1200.00,
  "totalDeposits": 1500.00,
  "totalWithdrawals": 200.00,
  "totalTransfersOut": 100.00,
  "totalTransfersIn": 0.00,
  "transactionCount": 3,
  "lastUpdated": "2024-01-01T12:00:00.000Z",
  "isActive": true
}
```

## Paystack Payment API Endpoints

### Base URL
`http://localhost:5000/api/payment`

### 1. Initialize Payment
**POST** `/initialize`

**Body:**
```json
{
  "amount": 500.00,
  "description": "Wallet funding"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "data": {
    "authorization_url": "https://checkout.paystack.com/abc123",
    "access_code": "access_code_123",
    "reference": "paystack_ref_123456",
    "amount": 500.00,
    "description": "Wallet funding"
  }
}
```

### 2. Verify Payment
**POST** `/verify/:reference`

**Response:**
```json
{
  "success": true,
  "message": "Payment verified and wallet funded successfully",
  "data": {
    "transactionId": "txn_123456",
    "reference": "paystack_ref_123456",
    "amount": 500.00,
    "newBalance": 1500.00,
    "paidAt": "2024-01-01T12:00:00.000Z",
    "paymentMethod": "card"
  }
}
```

### 3. Get Transaction Status
**GET** `/status/:reference`

**Response:**
```json
{
  "success": true,
  "data": {
    "reference": "paystack_ref_123456",
    "status": "success",
    "amount": 500.00,
    "paidAt": "2024-01-01T12:00:00.000Z",
    "gatewayResponse": "Successful",
    "channel": "card"
  }
}
```

### 4. Get Banks List
**GET** `/banks`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Access Bank",
      "slug": "access-bank",
      "code": "044",
      "longcode": "044150015",
      "gateway": "etranzact",
      "pay_with_bank": true,
      "active": true,
      "is_deleted": false,
      "country": "Nigeria",
      "currency": "NGN",
      "type": "nuban",
      "id": 1
    }
  ]
}
```

### 5. Resolve Bank Account
**POST** `/resolve-account`

**Body:**
```json
{
  "accountNumber": "1234567890",
  "bankCode": "044"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "account_number": "1234567890",
    "account_name": "John Doe",
    "bank_id": 1
  }
}
```

### 6. Create Transfer Recipient
**POST** `/create-recipient`

**Body:**
```json
{
  "name": "John Doe",
  "accountNumber": "1234567890",
  "bankCode": "044"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transfer recipient created successfully",
  "data": {
    "recipient_code": "RCP_123456",
    "type": "nuban",
    "name": "John Doe",
    "description": "John Doe - Access Bank",
    "account_number": "1234567890",
    "bank_name": "Access Bank",
    "bank_code": "044"
  }
}
```

### 7. Webhook Handler
**POST** `/webhook`

This endpoint handles Paystack webhooks for real-time payment notifications. The webhook URL should be configured in your Paystack dashboard.

## Error Responses

### 400 Bad Request
```json
{
  "message": "Amount must be greater than 0"
}
```

### 401 Unauthorized
```json
{
  "message": "Authentication required"
}
```

### 404 Not Found
```json
{
  "message": "Recipient not found"
}
```

### 500 Server Error
```json
{
  "message": "Server error"
}
```

## Testing with curl

### Get Balance
```bash
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/wallet/balance
```

### Add Money
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 500, "description": "Test deposit"}' \
  http://localhost:5000/api/wallet/add-money
```

### Create Transfer Recipient
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "accountNumber": "1234567890", "bankCode": "044"}' \
  http://localhost:5000/api/wallet/create-recipient
```

### Withdraw to Bank
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 200, "description": "Bank withdrawal", "recipientCode": "RCP_123456"}' \
  http://localhost:5000/api/wallet/withdraw
```

### Get Banks List
```bash
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/wallet/banks
```

### Resolve Bank Account
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"accountNumber": "1234567890", "bankCode": "044"}' \
  http://localhost:5000/api/wallet/resolve-account
```

### Initialize Paystack Payment
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 500, "description": "Test payment"}' \
  http://localhost:5000/api/payment/initialize
```

### Verify Paystack Payment
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/payment/verify/paystack_ref_123456
```

### Get Banks List
```bash
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/payment/banks
```

### Transfer Money
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"recipientPhone": "+1234567890", "amount": 100, "description": "Test transfer"}' \
  http://localhost:5000/api/wallet/transfer
```

## Paystack Configuration

### 1. Get Paystack Credentials
- Sign up at [Paystack](https://paystack.com)
- Get your Secret Key from the dashboard
- Configure webhook URL: `http://yourdomain.com/api/payment/webhook`

### 2. Environment Variables
Add these to your `.env` file:
```env
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxx
PAYSTACK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
PAYSTACK_CALLBACK_URL=http://localhost:5000/payment/success
APP_URL=http://localhost:5000
```

### 3. Webhook Events
The system handles these Paystack events:
- `charge.success` - Automatic wallet funding
- `transfer.success` - Transfer completion
- `transfer.failed` - Transfer failure

## Security Notes

1. **Webhook Security**: Always verify webhook signatures
2. **Transaction Deduplication**: System prevents duplicate transactions
3. **Amount Validation**: All amounts are validated before processing
4. **User Authentication**: All endpoints require valid authentication tokens
5. **Rate Limiting**: Built-in rate limiting to prevent abuse
