import mongoose from "mongoose";

const virtualAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  accountName: {
    type: String,
    required: true,
  },
  accountNumber: {
    type: String,
    required: true,
    unique: true,
  },
  bankName: {
    type: String,
    required: true,
  },
  bankCode: {
    type: String,
    required: true,
  },
  provider: {
    type: String,
    enum: ["paystack", "monnify", "flutterwave"],
    required: true,
  },
  providerReference: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  restrictions: {
    singleTransactionLimit: {
      type: Number,
      default: 1000000, // 1M NGN default
    },
    dailyTransactionLimit: {
      type: Number,
      default: 5000000, // 5M NGN default
    },
    allowedSources: [{
      type: String,
      enum: ["bank_transfer", "ussd", "deposit"],
    }],
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastTransactionAt: {
    type: Date,
    default: null,
  },
  totalReceived: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
  indexes: [
    { userId: 1 },
    { accountNumber: 1 },
    { providerReference: 1 },
    { provider: 1 },
    { isActive: 1 },
  ]
});

// Static method to create virtual account
virtualAccountSchema.statics.createVirtualAccount = async function(userId, accountName, provider = "paystack") {
  const existing = await this.findOne({ userId });
  if (existing) {
    throw new Error("User already has a virtual account");
  }

  let providerData;
  
  switch (provider) {
    case "paystack":
      providerData = await this.createPaystackVirtualAccount(userId, accountName);
      break;
    case "monnify":
      providerData = await this.createMonnifyVirtualAccount(userId, accountName);
      break;
    case "flutterwave":
      providerData = await this.createFlutterwaveVirtualAccount(userId, accountName);
      break;
    default:
      throw new Error("Unsupported provider");
  }

  const virtualAccount = new this({
    userId,
    accountName,
    accountNumber: providerData.accountNumber,
    bankName: providerData.bankName,
    bankCode: providerData.bankCode,
    provider,
    providerReference: providerData.reference,
    restrictions: {
      singleTransactionLimit: 1000000,
      dailyTransactionLimit: 5000000,
      allowedSources: ["bank_transfer", "ussd", "deposit"]
    }
  });

  await virtualAccount.save();
  return virtualAccount;
};

// Static method for Paystack virtual account creation
virtualAccountSchema.statics.createPaystackVirtualAccount = async function(userId, accountName) {
  // This would integrate with Paystack's dedicated account API
  // For now, returning mock data
  const mockAccountNumber = `99${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
  
  return {
    accountNumber: mockAccountNumber,
    bankName: "Providus Bank",
    bankCode: "101",
    reference: `dva_${userId}_${Date.now()}`
  };
};

// Static method for Monnify virtual account creation
virtualAccountSchema.statics.createMonnifyVirtualAccount = async function(userId, accountName) {
  // This would integrate with Monnify's reserved account API
  const mockAccountNumber = `50${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
  
  return {
    accountNumber: mockAccountNumber,
    bankName: "Wema Bank",
    bankCode: "035",
    reference: `MFY_${userId}_${Date.now()}`
  };
};

// Static method for Flutterwave virtual account creation
virtualAccountSchema.statics.createFlutterwaveVirtualAccount = async function(userId, accountName) {
  // This would integrate with Flutterwave's virtual account API
  const mockAccountNumber = `62${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
  
  return {
    accountNumber: mockAccountNumber,
    bankName: "Access Bank",
    bankCode: "044",
    reference: `FW_${userId}_${Date.now()}`
  };
};

// Instance method to update transaction stats
virtualAccountSchema.methods.updateTransactionStats = async function(amount) {
  this.totalReceived += amount;
  this.lastTransactionAt = new Date();
  await this.save();
};

// Instance method to check transaction limits
virtualAccountSchema.methods.checkTransactionLimit = async function(amount, transactionDate = new Date()) {
  // Check single transaction limit
  if (amount > this.restrictions.singleTransactionLimit) {
    throw new Error(`Amount exceeds single transaction limit of ${this.restrictions.singleTransactionLimit}`);
  }

  // Check daily transaction limit
  const startOfDay = new Date(transactionDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(transactionDate);
  endOfDay.setHours(23, 59, 59, 999);

  // This would typically query transaction history
  // For now, using the total received as a simplified check
  if (this.totalReceived + amount > this.restrictions.dailyTransactionLimit) {
    throw new Error(`Amount exceeds daily transaction limit of ${this.restrictions.dailyTransactionLimit}`);
  }

  return true;
};

// Static method to get user's virtual account
virtualAccountSchema.statics.getUserVirtualAccount = async function(userId) {
  return this.findOne({ userId, isActive: true });
};

// Static method to deactivate virtual account
virtualAccountSchema.statics.deactivateVirtualAccount = async function(userId) {
  return this.updateOne({ userId }, { isActive: false });
};

export default mongoose.model("VirtualAccount", virtualAccountSchema);
