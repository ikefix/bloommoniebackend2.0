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

export default mongoose.model("Savings", savingsSchema);