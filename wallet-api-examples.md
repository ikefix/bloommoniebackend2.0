# Wallet API Endpoints

## Base URL
`http://localhost:5000/api/wallet`

## Authentication
All endpoints require authentication token in headers:
```
Authorization: Bearer <token>
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

### 3. Withdraw Money from Wallet
**POST** `/withdraw`

**Body:**
```json
{
  "amount": 200.00,
  "description": "ATM withdrawal"
}
```

**Response:**
```json
{
  "message": "Money withdrawn successfully",
  "newBalance": 1300.00,
  "transaction": {
    "type": "withdrawal",
    "amount": 200.00,
    "description": "ATM withdrawal",
    "balance": 1300.00,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### 4. Transfer Money to Another User
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

### 5. Get Transaction History
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

### 6. Get Wallet Summary
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

### Transfer Money
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"recipientPhone": "+1234567890", "amount": 100, "description": "Test transfer"}' \
  http://localhost:5000/api/wallet/transfer
```
