import mongoose from "mongoose";

const savingsPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: "",
  },
  type: {
    type: String,
    enum: ["fixed", "flexible", "target", "goal"],
    required: true,
  },
  targetAmount: {
    type: Number,
    default: 0,
  },
  currentAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  interestRate: {
    type: Number,
    default: 0, // Annual interest rate in percentage
  },
  maturityDate: {
    type: Date,
    default: null,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["active", "matured", "withdrawn", "paused", "terminated"],
    default: "active",
  },
  autoSave: {
    enabled: {
      type: Boolean,
      default: false,
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      default: "monthly",
    },
    amount: {
      type: Number,
      default: 0,
    },
    nextSaveDate: {
      type: Date,
      default: null,
    },
  },
  withdrawalRules: {
    penaltyFee: {
      type: Number,
      default: 0, // Percentage penalty for early withdrawal
    },
    minWithdrawalAmount: {
      type: Number,
      default: 0,
    },
    maxWithdrawalsPerMonth: {
      type: Number,
      default: 0, // 0 means unlimited
    },
    requiresApproval: {
      type: Boolean,
      default: false,
    },
    withdrawalFee: {
      type: Number,
      default: 0, // Percentage fee for withdrawals
    }
  },
  fees: {
    managementFee: {
      type: Number,
      default: 0, // Annual management fee percentage
    },
    managementFeeFrequency: {
      type: String,
      enum: ["monthly", "quarterly", "annually"],
      default: "annually"
    },
    transactionFees: {
      contribution: {
        type: Number,
        default: 0, // Fee percentage for contributions
      },
      withdrawal: {
        type: Number,
        default: 0, // Fee percentage for withdrawals
      },
      transfer: {
        type: Number,
        default: 0, // Fee percentage for transfers
      }
    },
    maintenanceFee: {
      type: Number,
      default: 0, // Monthly maintenance fee in Naira
    },
    maintenanceFeeWaiver: {
      type: Number,
      default: 10000, // Minimum balance to waive maintenance fee
    },
    lastManagementFeeDeducted: {
      type: Date,
      default: null,
    },
    lastMaintenanceFeeDeducted: {
      type: Date,
      default: null,
    }
  },
  contributions: [{
    amount: {
      type: Number,
      required: true,
    },
    reference: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  withdrawals: [{
    amount: {
      type: Number,
      required: true,
    },
    reference: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    penaltyFee: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  }],
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
}, {
  timestamps: true,
  indexes: [
    { userId: 1, status: 1 },
    { userId: 1, type: 1 },
    { maturityDate: 1 },
    { status: 1, maturityDate: 1 },
  ]
});

// Virtual for progress percentage
savingsPlanSchema.virtual('progressPercentage').get(function() {
  if (this.targetAmount <= 0) return 0;
  return Math.min((this.currentAmount / this.targetAmount) * 100, 100);
});

// Virtual for days to maturity
savingsPlanSchema.virtual('daysToMaturity').get(function() {
  if (!this.maturityDate) return null;
  const now = new Date();
  const maturity = new Date(this.maturityDate);
  const diffTime = maturity - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for is matured
savingsPlanSchema.virtual('isMatured').get(function() {
  if (!this.maturityDate) return false;
  return new Date() >= new Date(this.maturityDate);
});

// Virtual for available balance
savingsPlanSchema.virtual('availableBalance').get(function() {
  const pendingWithdrawals = this.withdrawals
    .filter(w => w.status === 'pending')
    .reduce((sum, w) => sum + w.amount, 0);
  
  return Math.max(this.currentAmount - pendingWithdrawals, 0);
});

// Pre-save middleware
savingsPlanSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  
  // Update status if matured
  if (this.maturityDate && new Date() >= new Date(this.maturityDate) && this.status === "active") {
    this.status = "matured";
  }
  
  next();
});

// Instance method to add contribution
savingsPlanSchema.methods.addContribution = async function(amount, reference, description = "") {
  if (amount <= 0) {
    throw new Error("Contribution amount must be positive");
  }
  
  if (this.status !== "active") {
    throw new Error("Cannot contribute to inactive savings plan");
  }
  
  // Check if target amount reached
  if (this.targetAmount > 0 && this.currentAmount + amount > this.targetAmount) {
    throw new Error("Contribution exceeds target amount");
  }
  
  // Calculate transaction fee
  const transactionFee = this.calculateTransactionFee(amount, "contribution");
  const netAmount = amount - transactionFee;
  
  this.currentAmount += netAmount;
  this.contributions.push({
    amount: netAmount,
    reference,
    description,
    createdAt: new Date()
  });
  
  await this.save();
  return {
    grossAmount: amount,
    transactionFee,
    netAmount,
    contribution: this.contributions[this.contributions.length - 1]
  };
};

// Instance method to request withdrawal
savingsPlanSchema.methods.requestWithdrawal = async function(amount, description = "") {
  if (amount <= 0) {
    throw new Error("Withdrawal amount must be positive");
  }
  
  if (amount > this.currentAmount) {
    throw new Error("Insufficient balance");
  }
  
  if (this.status === "terminated") {
    throw new Error("Cannot withdraw from terminated savings plan");
  }
  
  // Check minimum withdrawal amount
  if (amount < this.withdrawalRules.minWithdrawalAmount) {
    throw new Error(`Minimum withdrawal amount is ${this.withdrawalRules.minWithdrawalAmount}`);
  }
  
  // Check monthly withdrawal limit
  if (this.withdrawalRules.maxWithdrawalsPerMonth > 0) {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const monthlyWithdrawals = this.withdrawals.filter(w => 
      w.createdAt >= thisMonth && w.status !== "rejected"
    );
    
    if (monthlyWithdrawals.length >= this.withdrawalRules.maxWithdrawalsPerMonth) {
      throw new Error("Monthly withdrawal limit exceeded");
    }
  }
  
  // Calculate fees
  const transactionFee = this.calculateTransactionFee(amount, "withdrawal");
  let penaltyFee = 0;
  
  // Calculate penalty fee for early withdrawal
  if (this.maturityDate && new Date() < new Date(this.maturityDate)) {
    penaltyFee = (amount * this.withdrawalRules.penaltyFee) / 100;
  }
  
  const withdrawalFee = (amount * this.withdrawalRules.withdrawalFee) / 100;
  const totalFees = transactionFee + penaltyFee + withdrawalFee;
  const netAmount = amount - totalFees;
  
  const reference = `WD_${this.userId}_${Date.now()}`;
  
  this.withdrawals.push({
    amount: netAmount,
    reference,
    description,
    penaltyFee,
    transactionFee,
    withdrawalFee,
    totalFees,
    grossAmount: amount,
    status: this.withdrawalRules.requiresApproval ? "pending" : "approved",
    createdAt: new Date()
  });
  
  // Auto-approve if not requiring approval
  if (!this.withdrawalRules.requiresApproval) {
    this.currentAmount -= amount;
    const withdrawal = this.withdrawals[this.withdrawals.length - 1];
    withdrawal.processedAt = new Date();
  }
  
  await this.save();
  return {
    ...this.withdrawals[this.withdrawals.length - 1],
    feeBreakdown: {
      transactionFee,
      penaltyFee,
      withdrawalFee,
      totalFees,
      grossAmount: amount,
      netAmount
    }
  };
};

// Instance method to approve withdrawal
savingsPlanSchema.methods.approveWithdrawal = async function(withdrawalId, approvedBy) {
  const withdrawal = this.withdrawals.id(withdrawalId);
  if (!withdrawal) {
    throw new Error("Withdrawal not found");
  }
  
  if (withdrawal.status !== "pending") {
    throw new Error("Withdrawal already processed");
  }
  
  withdrawal.status = "approved";
  withdrawal.approvedBy = approvedBy;
  withdrawal.processedAt = new Date();
  
  this.currentAmount -= (withdrawal.amount + withdrawal.penaltyFee);
  
  await this.save();
  return withdrawal;
};

// Instance method to reject withdrawal
savingsPlanSchema.methods.rejectWithdrawal = async function(withdrawalId, approvedBy) {
  const withdrawal = this.withdrawals.id(withdrawalId);
  if (!withdrawal) {
    throw new Error("Withdrawal not found");
  }
  
  if (withdrawal.status !== "pending") {
    throw new Error("Withdrawal already processed");
  }
  
  withdrawal.status = "rejected";
  withdrawal.approvedBy = approvedBy;
  withdrawal.processedAt = new Date();
  
  await this.save();
  return withdrawal;
};

// Instance method to calculate transaction fee
savingsPlanSchema.methods.calculateTransactionFee = function(amount, transactionType) {
  let fee = 0;
  
  switch (transactionType) {
    case "contribution":
      fee = (amount * this.fees.transactionFees.contribution) / 100;
      break;
    case "withdrawal":
      fee = (amount * this.fees.transactionFees.withdrawal) / 100;
      break;
    case "transfer":
      fee = (amount * this.fees.transactionFees.transfer) / 100;
      break;
  }
  
  return Math.round(fee * 100) / 100; // Round to 2 decimal places
};

// Instance method to calculate management fee
savingsPlanSchema.methods.calculateManagementFee = function() {
  if (this.fees.managementFee <= 0) return 0;
  
  const now = new Date();
  let feeAmount = 0;
  let nextDeductionDate = new Date();
  
  switch (this.fees.managementFeeFrequency) {
    case "monthly":
      feeAmount = (this.currentAmount * this.fees.managementFee / 100) / 12;
      if (this.fees.lastManagementFeeDeducted) {
        nextDeductionDate = new Date(this.fees.lastManagementFeeDeducted);
        nextDeductionDate.setMonth(nextDeductionDate.getMonth() + 1);
      }
      break;
    case "quarterly":
      feeAmount = (this.currentAmount * this.fees.managementFee / 100) / 4;
      if (this.fees.lastManagementFeeDeducted) {
        nextDeductionDate = new Date(this.fees.lastManagementFeeDeducted);
        nextDeductionDate.setMonth(nextDeductionDate.getMonth() + 3);
      }
      break;
    case "annually":
      feeAmount = (this.currentAmount * this.fees.managementFee / 100);
      if (this.fees.lastManagementFeeDeducted) {
        nextDeductionDate = new Date(this.fees.lastManagementFeeDeducted);
        nextDeductionDate.setFullYear(nextDeductionDate.getFullYear() + 1);
      }
      break;
  }
  
  return {
    amount: Math.round(feeAmount * 100) / 100,
    isDue: now >= nextDeductionDate,
    nextDeductionDate
  };
};

// Instance method to check maintenance fee
savingsPlanSchema.methods.checkMaintenanceFee = function() {
  if (this.fees.maintenanceFee <= 0) return { amount: 0, isDue: false, waived: true };
  
  const now = new Date();
  let lastDeduction = this.fees.lastMaintenanceFeeDeducted || this.createdAt;
  
  // Check if at least one month has passed
  const nextDeductionDate = new Date(lastDeduction);
  nextDeductionDate.setMonth(nextDeductionDate.getMonth() + 1);
  
  const isDue = now >= nextDeductionDate;
  const waived = this.currentAmount >= this.fees.maintenanceFeeWaiver;
  
  return {
    amount: this.fees.maintenanceFee,
    isDue,
    waived,
    nextDeductionDate
  };
};

// Instance method to deduct fees
savingsPlanSchema.methods.deductFees = async function() {
  const LedgerEntry = mongoose.model('LedgerEntry');
  const totalDeductions = [];
  
  // Check and deduct management fee
  const managementFee = this.calculateManagementFee();
  if (managementFee.isDue && managementFee.amount > 0) {
    const reference = `MGMT_FEE_${this._id}_${Date.now()}`;
    
    await LedgerEntry.createDoubleEntry([
      {
        accountType: "savings",
        accountId: this._id,
        userId: this.userId,
        debit: managementFee.amount,
        credit: 0,
        balance: this.currentAmount - managementFee.amount,
        reference,
        transactionType: "fee_deduction",
        description: `Management fee deduction (${this.fees.managementFeeFrequency})`,
        metadata: {
          feeType: "management",
          feeAmount: managementFee.amount,
          frequency: this.fees.managementFeeFrequency
        }
      },
      {
        accountType: "revenue",
        accountId: new mongoose.Types.ObjectId(),
        userId: this.userId,
        debit: 0,
        credit: managementFee.amount,
        balance: 0,
        reference,
        transactionType: "revenue",
        description: `Management fee revenue from ${this.name}`,
        metadata: {
          feeType: "management",
          savingsPlanId: this._id
        }
      }
    ]);
    
    this.currentAmount -= managementFee.amount;
    this.fees.lastManagementFeeDeducted = new Date();
    
    totalDeductions.push({
      type: "Management Fee",
      amount: managementFee.amount,
      frequency: this.fees.managementFeeFrequency
    });
  }
  
  // Check and deduct maintenance fee
  const maintenanceFee = this.checkMaintenanceFee();
  if (maintenanceFee.isDue && !maintenanceFee.waived && maintenanceFee.amount > 0) {
    const reference = `MAINT_FEE_${this._id}_${Date.now()}`;
    
    await LedgerEntry.createDoubleEntry([
      {
        accountType: "savings",
        accountId: this._id,
        userId: this.userId,
        debit: maintenanceFee.amount,
        credit: 0,
        balance: this.currentAmount - maintenanceFee.amount,
        reference,
        transactionType: "fee_deduction",
        description: "Monthly maintenance fee",
        metadata: {
          feeType: "maintenance",
          feeAmount: maintenanceFee.amount
        }
      },
      {
        accountType: "revenue",
        accountId: new mongoose.Types.ObjectId(),
        userId: this.userId,
        debit: 0,
        credit: maintenanceFee.amount,
        balance: 0,
        reference,
        transactionType: "revenue",
        description: `Maintenance fee revenue from ${this.name}`,
        metadata: {
          feeType: "maintenance",
          savingsPlanId: this._id
        }
      }
    ]);
    
    this.currentAmount -= maintenanceFee.amount;
    this.fees.lastMaintenanceFeeDeducted = new Date();
    
    totalDeductions.push({
      type: "Maintenance Fee",
      amount: maintenanceFee.amount
    });
  }
  
  await this.save();
  return totalDeductions;
};

// Instance method to get fee summary
savingsPlanSchema.methods.getFeeSummary = function() {
  const managementFee = this.calculateManagementFee();
  const maintenanceFee = this.checkMaintenanceFee();
  
  return {
    managementFee: {
      rate: this.fees.managementFee,
      frequency: this.fees.managementFeeFrequency,
      currentAmount: managementFee.amount,
      isDue: managementFee.isDue,
      nextDeductionDate: managementFee.nextDeductionDate
    },
    maintenanceFee: {
      amount: this.fees.maintenanceFee,
      isDue: maintenanceFee.isDue,
      waived: maintenanceFee.waived,
      waiverBalance: this.fees.maintenanceFeeWaiver,
      nextDeductionDate: maintenanceFee.nextDeductionDate
    },
    transactionFees: {
      contribution: this.fees.transactionFees.contribution,
      withdrawal: this.fees.transactionFees.withdrawal,
      transfer: this.fees.transactionFees.transfer
    },
    withdrawalRules: {
      penaltyFee: this.withdrawalRules.penaltyFee,
      withdrawalFee: this.withdrawalRules.withdrawalFee,
      minWithdrawalAmount: this.withdrawalRules.minWithdrawalAmount,
      maxWithdrawalsPerMonth: this.withdrawalRules.maxWithdrawalsPerMonth
    }
  };
};

// Instance method to calculate interest
savingsPlanSchema.methods.calculateInterest = function() {
  if (this.interestRate <= 0 || this.currentAmount <= 0) {
    return 0;
  }
  
  const daysActive = Math.floor((new Date() - new Date(this.startDate)) / (1000 * 60 * 60 * 24));
  const dailyRate = this.interestRate / 100 / 365;
  const interest = this.currentAmount * dailyRate * daysActive;
  
  return Math.round(interest * 100) / 100; // Round to 2 decimal places
};

// Static method to get user's savings plans
savingsPlanSchema.statics.getUserSavingsPlans = async function(userId, status = null) {
  const query = { userId };
  if (status) {
    query.status = status;
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to get matured plans
savingsPlanSchema.statics.getMaturedPlans = async function() {
  const now = new Date();
  return this.find({
    maturityDate: { $lte: now },
    status: "active"
  });
};

export default mongoose.model("SavingsPlan", savingsPlanSchema);
