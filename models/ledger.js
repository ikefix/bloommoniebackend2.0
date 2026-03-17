import mongoose from "mongoose";

const ledgerEntrySchema = new mongoose.Schema({
  accountType: {
    type: String,
    enum: ["wallet", "savings", "system", "settlement", "fee"],
    required: true,
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "accountType",
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  debit: {
    type: Number,
    default: 0,
    min: 0,
  },
  credit: {
    type: Number,
    default: 0,
    min: 0,
  },
  balance: {
    type: Number,
    required: true,
  },
  reference: {
    type: String,
    required: true,
    unique: true,
  },
  transactionType: {
    type: String,
    enum: ["deposit", "withdrawal", "transfer_in", "transfer_out", "fee", "settlement", "refund"],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "reversed"],
    default: "completed",
  },
  gatewayReference: {
    type: String,
    default: null,
  },
  ipAddress: {
    type: String,
    default: null,
  },
  userAgent: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { 
  timestamps: true,
  indexes: [
    { userId: 1, createdAt: -1 },
    { reference: 1 },
    { accountType: 1, accountId: 1, createdAt: -1 },
    { transactionType: 1, createdAt: -1 },
    { status: 1, createdAt: -1 },
  ]
});

// Pre-save middleware to ensure accounting integrity
ledgerEntrySchema.pre("save", async function(next) {
  // Ensure debit and credit are not both positive
  if (this.debit > 0 && this.credit > 0) {
    return next(new Error("Cannot have both debit and credit in same entry"));
  }
  
  // Ensure at least one of debit or credit is positive
  if (this.debit <= 0 && this.credit <= 0) {
    return next(new Error("Must have either debit or credit amount"));
  }
  
  this.updatedAt = new Date();
  next();
});

// Static method to create double-entry transaction
ledgerEntrySchema.statics.createDoubleEntry = async function(entries) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Validate that total debits equal total credits
    const totalDebit = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const totalCredit = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    
    if (totalDebit !== totalCredit) {
      throw new Error("Total debits must equal total credits");
    }
    
    // Create all entries
    const createdEntries = await this.insertMany(entries, { session });
    
    await session.commitTransaction();
    return createdEntries;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Static method to get account balance
ledgerEntrySchema.statics.getAccountBalance = async function(accountType, accountId) {
  const result = await this.aggregate([
    {
      $match: {
        accountType: accountType,
        accountId: accountId,
        status: "completed"
      }
    },
    {
      $group: {
        _id: null,
        totalCredits: { $sum: "$credit" },
        totalDebits: { $sum: "$debit" },
        lastEntry: { $max: "$createdAt" }
      }
    }
  ]);
  
  if (result.length === 0) {
    return { balance: 0, lastEntry: null };
  }
  
  return {
    balance: result[0].totalCredits - result[0].totalDebits,
    lastEntry: result[0].lastEntry
  };
};

// Static method to check if reference exists
ledgerEntrySchema.statics.referenceExists = async function(reference) {
  const exists = await this.findOne({ reference });
  return !!exists;
};

// Instance method to reverse entry
ledgerEntrySchema.methods.reverse = async function(reason, reversedBy) {
  if (this.status === "reversed") {
    throw new Error("Entry already reversed");
  }
  
  const reverseEntry = new this.constructor({
    accountType: this.accountType,
    accountId: this.accountId,
    userId: this.userId,
    debit: this.credit,
    credit: this.debit,
    balance: this.balance,
    reference: `REV_${this.reference}_${Date.now()}`,
    transactionType: "refund",
    description: `Reversal: ${reason}`,
    metadata: {
      originalReference: this.reference,
      reversedBy,
      reversedAt: new Date()
    },
    status: "completed"
  });
  
  this.status = "reversed";
  await this.save();
  await reverseEntry.save();
  
  return reverseEntry;
};

export default mongoose.model("LedgerEntry", ledgerEntrySchema);
