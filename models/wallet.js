import mongoose from "mongoose";

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  balance: {
    type: Number,
    default: 0,
    min: 0,
  },
  availableBalance: {
    type: Number,
    default: 0,
    min: 0,
  },
  lockedBalance: {
    type: Number,
    default: 0,
    min: 0,
  },
  currency: {
    type: String,
    default: "NGN",
    enum: ["NGN", "USD", "EUR", "GBP"],
  },
  status: {
    type: String,
    enum: ["active", "frozen", "suspended", "closed"],
    default: "active",
  },
  limits: {
    dailyTransactionLimit: {
      type: Number,
      default: 1000000, // 1M NGN default
    },
    singleTransactionLimit: {
      type: Number,
      default: 100000, // 100k NGN default
    },
    monthlyTransactionLimit: {
      type: Number,
      default: 5000000, // 5M NGN default
    },
  },
  verification: {
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationLevel: {
      type: String,
      enum: ["basic", "intermediate", "advanced"],
      default: "basic",
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    documents: [{
      type: {
        type: String,
        enum: ["id_card", "utility_bill", "passport", "selfie"],
      },
      url: String,
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
    }],
  },
  security: {
    pin: {
      type: String,
      default: null,
    },
    pinSetAt: {
      type: Date,
      default: null,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  lastTransactionAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
  indexes: [
    { userId: 1 },
    { status: 1 },
    { "verification.isVerified": 1 },
    { "security.twoFactorEnabled": 1 },
    { balance: 1 },
    { createdAt: -1 },
  ]
});

// Virtual for total transaction count
walletSchema.virtual('totalTransactions', {
  ref: 'LedgerEntry',
  localField: 'userId',
  foreignField: 'userId',
  count: true
});

// Virtual for savings plans
walletSchema.virtual('savingsPlans', {
  ref: 'SavingsPlan',
  localField: 'userId',
  foreignField: 'userId'
});

// Pre-save middleware
walletSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  
  // Ensure available balance is never negative
  if (this.availableBalance < 0) {
    this.availableBalance = 0;
  }
  
  // Ensure locked balance is never negative
  if (this.lockedBalance < 0) {
    this.lockedBalance = 0;
  }
  
  // Ensure balance equals available + locked
  this.balance = this.availableBalance + this.lockedBalance;
  
  next();
});

// Instance method to check if wallet is locked
walletSchema.methods.isLocked = function() {
  return this.lockedUntil && new Date() < this.lockedUntil;
};

// Instance method to lock wallet
walletSchema.methods.lockWallet = function(hours = 24) {
  this.lockedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
  return this.save();
};

// Instance method to unlock wallet
walletSchema.methods.unlockWallet = function() {
  this.lockedUntil = null;
  this.loginAttempts = 0;
  return this.save();
};

// Instance method to increment login attempts
walletSchema.methods.incrementLoginAttempts = function() {
  this.loginAttempts += 1;
  
  // Lock after 5 failed attempts
  if (this.loginAttempts >= 5) {
    this.lockWallet(24); // Lock for 24 hours
  }
  
  return this.save();
};

// Instance method to check transaction limits
walletSchema.methods.checkTransactionLimit = async function(amount, transactionType = "transfer") {
  if (amount > this.limits.singleTransactionLimit) {
    throw new Error(`Amount exceeds single transaction limit of ${this.limits.singleTransactionLimit}`);
  }
  
  if (amount > this.availableBalance) {
    throw new Error("Insufficient available balance");
  }
  
  // Check daily limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // This would typically query the ledger entries
  // For now, using a simplified check
  const dailyTotal = 0; // This should be calculated from actual transactions
  
  if (dailyTotal + amount > this.limits.dailyTransactionLimit) {
    throw new Error(`Daily transaction limit exceeded`);
  }
  
  return true;
};

// Instance method to lock funds
walletSchema.methods.lockFunds = async function(amount, reason) {
  if (amount > this.availableBalance) {
    throw new Error("Insufficient available balance to lock");
  }
  
  this.availableBalance -= amount;
  this.lockedBalance += amount;
  
  await this.save();
  
  return {
    lockedAmount: amount,
    availableBalance: this.availableBalance,
    lockedBalance: this.lockedBalance,
    reason
  };
};

// Instance method to unlock funds
walletSchema.methods.unlockFunds = async function(amount) {
  if (amount > this.lockedBalance) {
    throw new Error("Insufficient locked balance to unlock");
  }
  
  this.lockedBalance -= amount;
  this.availableBalance += amount;
  
  await this.save();
  
  return {
    unlockedAmount: amount,
    availableBalance: this.availableBalance,
    lockedBalance: this.lockedBalance
  };
};

// Instance method to update balance (should be used with ledger entries)
walletSchema.methods.updateBalance = async function(amount, type) {
  if (type === "credit") {
    this.availableBalance += amount;
  } else if (type === "debit") {
    if (amount > this.availableBalance) {
      throw new Error("Insufficient balance");
    }
    this.availableBalance -= amount;
  } else {
    throw new Error("Invalid transaction type");
  }
  
  this.lastTransactionAt = new Date();
  await this.save();
  
  return this;
};

// Instance method to get wallet summary
walletSchema.methods.getSummary = async function() {
  const LedgerEntry = mongoose.model('LedgerEntry');
  const SavingsPlan = mongoose.model('SavingsPlan');
  
  // Get transaction stats
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const transactionStats = await LedgerEntry.aggregate([
    {
      $match: {
        userId: this.userId,
        createdAt: { $gte: thirtyDaysAgo },
        status: "completed"
      }
    },
    {
      $group: {
        _id: null,
        totalCredits: { $sum: "$credit" },
        totalDebits: { $sum: "$debit" },
        transactionCount: { $sum: 1 }
      }
    }
  ]);
  
  const stats = transactionStats[0] || { totalCredits: 0, totalDebits: 0, transactionCount: 0 };
  
  // Get savings summary
  const savingsPlans = await SavingsPlan.find({ userId: this.userId });
  const totalSavings = savingsPlans.reduce((sum, plan) => sum + plan.currentAmount, 0);
  const activeSavings = savingsPlans.filter(plan => plan.status === "active").length;
  
  return {
    balance: this.balance,
    availableBalance: this.availableBalance,
    lockedBalance: this.lockedBalance,
    currency: this.currency,
    status: this.status,
    verificationLevel: this.verificationLevel,
    isVerified: this.verification.isVerified,
    totalSavings,
    activeSavings,
    thirtyDayStats: {
      totalDeposits: stats.totalCredits,
      totalWithdrawals: stats.totalDebits,
      netFlow: stats.totalCredits - stats.totalDebits,
      transactionCount: stats.transactionCount
    },
    lastTransactionAt: this.lastTransactionAt,
    createdAt: this.createdAt
  };
};

// Static method to create wallet for user
walletSchema.statics.createWallet = async function(userId, currency = "NGN") {
  const existingWallet = await this.findOne({ userId });
  if (existingWallet) {
    throw new Error("Wallet already exists for this user");
  }
  
  const wallet = new this({
    userId,
    currency,
    availableBalance: 0,
    lockedBalance: 0,
    balance: 0
  });
  
  await wallet.save();
  return wallet;
};

// Static method to get user wallet
walletSchema.statics.getUserWallet = async function(userId) {
  let wallet = await this.findOne({ userId });
  
  if (!wallet) {
    wallet = await this.createWallet(userId);
  }
  
  return wallet;
};

// Static method to freeze wallet
walletSchema.statics.freezeWallet = async function(userId, reason) {
  const wallet = await this.findOne({ userId });
  if (!wallet) {
    throw new Error("Wallet not found");
  }
  
  wallet.status = "frozen";
  wallet.metadata = { ...wallet.metadata, freezeReason: reason, frozenAt: new Date() };
  
  await wallet.save();
  return wallet;
};

// Static method to unfreeze wallet
walletSchema.statics.unfreezeWallet = async function(userId) {
  const wallet = await this.findOne({ userId });
  if (!wallet) {
    throw new Error("Wallet not found");
  }
  
  wallet.status = "active";
  delete wallet.metadata.freezeReason;
  delete wallet.metadata.frozenAt;
  
  await wallet.save();
  return wallet;
};

export default mongoose.model("Wallet", walletSchema);
