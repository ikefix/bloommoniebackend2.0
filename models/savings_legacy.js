import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["deposit", "withdrawal", "transfer_in", "transfer_out"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  balance: {
    type: Number,
    required: true,
  },
});

// Legacy savings model - maintained for backward compatibility
const savingsSchema = new mongoose.Schema({
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
  transactions: [transactionSchema],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  // Migration flag to track if this has been migrated to new system
  migrated: {
    type: Boolean,
    default: false,
  },
  migratedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SavingsPlan",
    default: null,
  },
}, { timestamps: true });

savingsSchema.pre("save", function(next) {
  this.lastUpdated = new Date();
  next();
});

savingsSchema.methods.addTransaction = function(type, amount, description, fromUser = null, toUser = null) {
  const transaction = {
    type,
    amount,
    description,
    fromUser,
    toUser,
    balance: this.balance,
    timestamp: new Date(),
  };
  
  this.transactions.push(transaction);
  return this.save();
};

savingsSchema.methods.getRecentTransactions = function(limit = 10) {
  return this.transactions
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to migrate legacy savings to new system
savingsSchema.statics.migrateToNewSystem = async function(userId) {
  const legacySavings = await this.findOne({ userId, migrated: false });
  
  if (!legacySavings) {
    return null; // Already migrated or doesn't exist
  }

  const SavingsPlan = mongoose.model('SavingsPlan');
  const Wallet = mongoose.model('Wallet');
  const LedgerEntry = mongoose.model('LedgerEntry');

  try {
    // Create new savings plan
    const newSavingsPlan = new SavingsPlan({
      userId: userId,
      name: "Migrated Savings",
      description: "Migrated from legacy savings system",
      type: "flexible",
      targetAmount: 0,
      currentAmount: legacySavings.balance,
      status: "active"
    });

    await newSavingsPlan.save();

    // Get user wallet
    const wallet = await Wallet.getUserWallet(userId);

    // Create ledger entries for existing balance
    if (legacySavings.balance > 0) {
      const reference = `MIGRATION_${userId}_${Date.now()}`;
      
      await LedgerEntry.createDoubleEntry([
        {
          accountType: "savings",
          accountId: newSavingsPlan._id,
          userId: userId,
          debit: 0,
          credit: legacySavings.balance,
          balance: legacySavings.balance,
          reference,
          transactionType: "deposit",
          description: "Balance migration from legacy system",
          metadata: {
            migrationSource: "legacy_savings",
            originalSavingsId: legacySavings._id
          }
        },
        {
          accountType: "system",
          accountId: new mongoose.Types.ObjectId(),
          userId: userId,
          debit: legacySavings.balance,
          credit: 0,
          balance: 0,
          reference,
          transactionType: "settlement",
          description: "Migration settlement",
          metadata: {
            migrationSource: "legacy_savings",
            originalSavingsId: legacySavings._id
          }
        }
      ]);
    }

    // Migrate transactions
    for (const transaction of legacySavings.transactions) {
      await newSavingsPlan.addTransaction(
        transaction.amount,
        `MIG_${transaction.reference || Date.now()}`,
        `Migrated: ${transaction.description}`
      );
    }

    // Mark as migrated
    legacySavings.migrated = true;
    legacySavings.migratedTo = newSavingsPlan._id;
    await legacySavings.save();

    return newSavingsPlan;
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
};

// Static method to check migration status
savingsSchema.statics.getMigrationStatus = async function(userId) {
  const legacySavings = await this.findOne({ userId });
  
  if (!legacySavings) {
    return { exists: false, migrated: false };
  }

  return {
    exists: true,
    migrated: legacySavings.migrated,
    balance: legacySavings.balance,
    transactionCount: legacySavings.transactions.length,
    migratedTo: legacySavings.migratedTo,
    createdAt: legacySavings.createdAt
  };
};

export default mongoose.model("Savings", savingsSchema);