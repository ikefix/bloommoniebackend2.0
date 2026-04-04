import mongoose from "mongoose";
import Wallet from "./wallet.js";
import VirtualAccount from "./virtualAccount.js";
import SavingsPlan from "./savingsPlan.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "cashier", "manager"],
      default: "cashier",
    },

    phone: {
      type: String,
      unique: true,
    },

    profileImage: {
      type: String,
      default: ''
    },

    verified: {
      type: Boolean,
      default: false,
    },

    verificationToken: {
      type: String,
      default: null,
    },

    otp: {
      type: String,
      default: null,
    },

    otpCreatedAt: {
      type: Date,
      default: null,
    },

    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordTokenExpiry: {
      type: Date,
      default: null,
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    googleId: {
      type: String,
      default: null,
    },

    subscription: {
      type: String,
      enum: ["free", "basic", "lite", "business"],
      default: "free",
    },

    termsAndConditionsAccepted: {
      type: Boolean,
      default: false,
    },
    
    // Relationships
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet"
    },
    
    virtualAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VirtualAccount"
    },
    
    savingsPlans: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "SavingsPlan"
    }],
    
    // KYC and Verification
    kycStatus: {
      type: String,
      enum: ["not_started", "pending", "verified", "rejected"],
      default: "not_started"
    },
    
    kycDocuments: [{
      type: {
        type: String,
        enum: ["id_card", "utility_bill", "passport", "selfie"]
      },
      url: String,
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Security
    lastLoginAt: {
      type: Date,
      default: null
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    accountLocked: {
      type: Boolean,
      default: false
    },
    lockedUntil: {
      type: Date,
      default: null
    },
    
    // Preferences
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    },
    
    // Statistics
    totalTransactions: {
      type: Number,
      default: 0
    },
    totalDeposits: {
      type: Number,
      default: 0
    },
    totalWithdrawals: {
      type: Number,
      default: 0
    },
    
    // Referral system
    referralCode: {
      type: String,
      unique: true,
      sparse: true
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    referralCount: {
      type: Number,
      default: 0
    },
    
    // Device tracking
    devices: [{
      deviceId: String,
      deviceType: {
        type: String,
        enum: ["web", "mobile", "tablet"]
      },
      userAgent: String,
      ipAddress: String,
      lastUsed: {
        type: Date,
        default: Date.now
      },
      isTrusted: {
        type: Boolean,
        default: false
      }
    }]
  },
  { timestamps: true }
);

// Pre-save middleware
userSchema.pre("save", function() {
  // Generate referral code if not exists
  if (!this.referralCode) {
    const code = this.name.substring(0, 3).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase();
    this.referralCode = code;
  }
  
  // Update last login if password is being changed (login attempt)
  if (this.isModified('password') && !this.isNew) {
    this.lastLoginAt = new Date();
    this.loginAttempts = 0;
    this.accountLocked = false;
    this.lockedUntil = null;
  }
});

// Instance method to lock account
userSchema.methods.lockAccount = function(hours = 24) {
  this.accountLocked = true;
  this.lockedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
  return this.save();
}

// Instance method to unlock account
userSchema.methods.unlockAccount = function() {
  this.accountLocked = false;
  this.lockedUntil = null;
  this.loginAttempts = 0;
  return this.save();
}

// Instance method to increment login attempts
userSchema.methods.incrementLoginAttempts = async function() {
  this.loginAttempts += 1;
  
  // Lock after 5 failed attempts
  if (this.loginAttempts >= 5) {
    await this.lockAccount(24);
  } else {
    await this.save();
  }
  
  return this;
}

// Static method to find user by referral code
userSchema.statics.findByReferralCode = function(referralCode) {
  return this.findOne({ referralCode: referralCode.toUpperCase() });
}

// Static method to get user statistics
userSchema.statics.getUserStats = async function(userId) {
  const LedgerEntry = mongoose.model('LedgerEntry');
  const SavingsPlan = mongoose.model('SavingsPlan');
  
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // Get transaction stats
  const transactionStats = await LedgerEntry.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
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
  
  // Get savings stats
  const savingsStats = await SavingsPlan.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: { $in: ["active", "matured"] }
      }
    },
    {
      $group: {
        _id: null,
        totalSavings: { $sum: "$currentAmount" },
        activePlans: { $sum: 1 }
      }
    }
  ]);
  
  const savings = savingsStats[0] || { totalSavings: 0, activePlans: 0 };
  
  return {
    thirtyDayStats: {
      totalDeposits: stats.totalCredits,
      totalWithdrawals: stats.totalDebits,
      netFlow: stats.totalCredits - stats.totalDebits,
      transactionCount: stats.transactionCount
    },
    savingsStats: {
      totalSavings: savings.totalSavings,
      activePlans: savings.activePlans
    }
  };
}

export default mongoose.model("User", userSchema);
