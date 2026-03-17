import mongoose from "mongoose";

const fraudDetectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  ipAddress: {
    type: String,
    required: true,
  },
  userAgent: {
    type: String,
    required: true,
  },
  deviceId: {
    type: String,
    default: null,
  },
  transactionReference: {
    type: String,
    required: true,
  },
  transactionType: {
    type: String,
    enum: ["deposit", "withdrawal", "transfer", "account_creation"],
    required: true,
  },
  amount: {
    type: Number,
    default: 0,
  },
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  riskFactors: [{
    type: String,
    enum: [
      "new_device",
      "new_ip",
      "high_amount",
      "rapid_transactions",
      "failed_attempts",
      "suspicious_location",
      "unusual_time",
      "multiple_accounts",
      "velocity_exceeded",
      "blacklisted_ip"
    ]
  }],
  status: {
    type: String,
    enum: ["pending", "approved", "flagged", "blocked", "investigating"],
    default: "pending",
  },
  action: {
    type: String,
    enum: ["allow", "require_otp", "block", "manual_review"],
    default: "allow",
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  indexes: [
    { userId: 1, createdAt: -1 },
    { ipAddress: 1, createdAt: -1 },
    { transactionReference: 1 },
    { status: 1, createdAt: -1 },
    { riskScore: 1, createdAt: -1 },
  ]
});

// Static method to analyze transaction
fraudDetectionSchema.statics.analyzeTransaction = async function(transactionData) {
  const { userId, ipAddress, userAgent, transactionType, amount, deviceId } = transactionData;
  
  const fraudCheck = new this({
    userId,
    ipAddress,
    userAgent,
    deviceId,
    transactionReference: transactionData.reference,
    transactionType,
    amount,
    riskScore: 0,
    riskFactors: [],
    status: "pending"
  });

  // Check various risk factors
  await fraudCheck.checkRiskFactors();
  
  // Determine action based on risk score
  fraudCheck.determineAction();
  
  await fraudCheck.save();
  return fraudCheck;
};

// Instance method to check risk factors
fraudDetectionSchema.methods.checkRiskFactors = async function() {
  const factors = [];
  let riskScore = 0;

  // Check if this is a new IP for the user
  const ipHistory = await this.constructor.find({ 
    userId: this.userId, 
    ipAddress: this.ipAddress,
    status: { $ne: "blocked" }
  }).limit(10);

  if (ipHistory.length === 0) {
    factors.push("new_ip");
    riskScore += 15;
  }

  // Check device history
  if (this.deviceId) {
    const deviceHistory = await this.constructor.find({ 
      userId: this.userId, 
      deviceId: this.deviceId,
      status: { $ne: "blocked" }
    }).limit(10);

    if (deviceHistory.length === 0) {
      factors.push("new_device");
      riskScore += 10;
    }
  }

  // Check transaction amount
  if (this.amount > 100000) { // > 100k NGN
    factors.push("high_amount");
    riskScore += 20;
  }

  // Check rapid transactions (last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentTransactions = await this.constructor.find({
    userId: this.userId,
    createdAt: { $gte: oneHourAgo },
    transactionType: this.transactionType
  });

  if (recentTransactions.length > 5) {
    factors.push("rapid_transactions");
    riskScore += 25;
  }

  // Check failed attempts (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const failedAttempts = await this.constructor.find({
    userId: this.userId,
    status: "blocked",
    createdAt: { $gte: oneDayAgo }
  });

  if (failedAttempts.length > 3) {
    factors.push("failed_attempts");
    riskScore += 30;
  }

  // Check unusual time (late night transactions)
  const hour = new Date().getHours();
  if (hour >= 23 || hour <= 5) {
    factors.push("unusual_time");
    riskScore += 10;
  }

  // Check blacklisted IPs (this would typically use a database of known malicious IPs)
  const blacklistedIPs = process.env.BLACKLISTED_IPS?.split(',') || [];
  if (blacklistedIPs.includes(this.ipAddress)) {
    factors.push("blacklisted_ip");
    riskScore += 50;
  }

  this.riskFactors = factors;
  this.riskScore = Math.min(riskScore, 100);
};

// Instance method to determine action
fraudDetectionSchema.methods.determineAction = function() {
  if (this.riskScore >= 70) {
    this.action = "block";
    this.status = "blocked";
  } else if (this.riskScore >= 50) {
    this.action = "manual_review";
    this.status = "flagged";
  } else if (this.riskScore >= 30) {
    this.action = "require_otp";
    this.status = "pending";
  } else {
    this.action = "allow";
    this.status = "approved";
  }
};

// Static method to check velocity limits
fraudDetectionSchema.statics.checkVelocityLimits = async function(userId, transactionType, amount) {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Check hourly limit
  const hourlyTransactions = await this.find({
    userId,
    transactionType,
    createdAt: { $gte: oneHourAgo },
    status: { $in: ["approved", "pending"] }
  });

  const hourlyTotal = hourlyTransactions.reduce((sum, t) => sum + t.amount, 0);
  if (hourlyTotal + amount > 500000) { // 500k NGN hourly limit
    throw new Error("Hourly transaction limit exceeded");
  }

  // Check daily limit
  const dailyTransactions = await this.find({
    userId,
    transactionType,
    createdAt: { $gte: oneDayAgo },
    status: { $in: ["approved", "pending"] }
  });

  const dailyTotal = dailyTransactions.reduce((sum, t) => sum + t.amount, 0);
  if (dailyTotal + amount > 2000000) { // 2M NGN daily limit
    throw new Error("Daily transaction limit exceeded");
  }

  return true;
};

// Static method to get user risk profile
fraudDetectionSchema.statics.getUserRiskProfile = async function(userId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const userChecks = await this.find({
    userId,
    createdAt: { $gte: thirtyDaysAgo }
  });

  const totalChecks = userChecks.length;
  const flaggedChecks = userChecks.filter(c => c.status === "flagged").length;
  const blockedChecks = userChecks.filter(c => c.status === "blocked").length;
  const avgRiskScore = userChecks.reduce((sum, c) => sum + c.riskScore, 0) / totalChecks || 0;

  return {
    totalChecks,
    flaggedChecks,
    blockedChecks,
    avgRiskScore: Math.round(avgRiskScore),
    riskLevel: avgRiskScore >= 50 ? "high" : avgRiskScore >= 30 ? "medium" : "low"
  };
};

export default mongoose.model("FraudDetection", fraudDetectionSchema);
