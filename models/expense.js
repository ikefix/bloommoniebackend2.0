import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ""
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ExpenseCategory",
    required: true
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ExpenseCategory",
    default: null
  },
  expenseDate: {
    type: Date,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ["cash", "card", "transfer", "cheque", "mobile_money", "other"],
    required: true
  },
  reference: {
    type: String,
    default: ""
  },
  receipt: {
    filename: String,
    url: String,
    uploadedAt: Date
  },
  attachments: [{
    filename: String,
    url: String,
    type: String,
    uploadedAt: Date
  }],
  tags: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "reimbursed"],
    default: "approved"
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  reimbursedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  reimbursedAt: {
    type: Date,
    default: null
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    type: String,
    enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
    default: null
  },
  recurringEndDate: {
    type: Date,
    default: null
  },
  nextRecurringDate: {
    type: Date,
    default: null
  },
  location: {
    type: String,
    default: ""
  },
  project: {
    type: String,
    default: ""
  },
  vendor: {
    name: String,
    email: String,
    phone: String,
    address: String
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: "NGN"
  },
  exchangeRate: {
    type: Number,
    default: 1,
    min: 0
  },
  notes: {
    type: String,
    default: ""
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
expenseSchema.index({ category: 1 });
expenseSchema.index({ subcategory: 1 });
expenseSchema.index({ expenseDate: -1 });
expenseSchema.index({ createdBy: 1 });
expenseSchema.index({ status: 1 });
expenseSchema.index({ isRecurring: 1 });
expenseSchema.index({ nextRecurringDate: 1 });
expenseSchema.index({ tags: 1 });

// Virtual for total with tax
expenseSchema.virtual("totalWithTax").get(function() {
  return this.amount + this.taxAmount;
});

// Virtual for is overdue
expenseSchema.virtual("isOverdue").get(function() {
  if (!this.isRecurring || !this.nextRecurringDate) return false;
  return new Date() > this.nextRecurringDate;
});

// Instance method to approve expense
expenseSchema.methods.approve = function(approvedBy) {
  this.status = "approved";
  this.approvedBy = approvedBy;
  return this.save();
};

// Instance method to reject expense
expenseSchema.methods.reject = function(approvedBy, reason) {
  this.status = "rejected";
  this.approvedBy = approvedBy;
  this.notes = (this.notes || "") + `\nRejected: ${reason}`;
  return this.save();
};

// Instance method to reimburse expense
expenseSchema.methods.reimburse = function(reimbursedBy) {
  this.status = "reimbursed";
  this.reimbursedBy = reimbursedBy;
  this.reimbursedAt = new Date();
  return this.save();
};

// Instance method to set next recurring date
expenseSchema.methods.setNextRecurringDate = function() {
  if (!this.isRecurring || !this.recurringPattern) {
    this.nextRecurringDate = null;
    return;
  }
  
  const currentDate = new Date();
  let nextDate = new Date(currentDate);
  
  switch (this.recurringPattern) {
    case "daily":
      nextDate.setDate(currentDate.getDate() + 1);
      break;
    case "weekly":
      nextDate.setDate(currentDate.getDate() + 7);
      break;
    case "monthly":
      nextDate.setMonth(currentDate.getMonth() + 1);
      break;
    case "quarterly":
      nextDate.setMonth(currentDate.getMonth() + 3);
      break;
    case "yearly":
      nextDate.setFullYear(currentDate.getFullYear() + 1);
      break;
  }
  
  // Check if we've passed the end date
  if (this.recurringEndDate && nextDate > this.recurringEndDate) {
    this.nextRecurringDate = null;
  } else {
    this.nextRecurringDate = nextDate;
  }
  
  return this.save();
};

// Static method to get expense summary
expenseSchema.statics.getExpenseSummary = async function(userId, startDate, endDate) {
  const matchStage = {
    createdBy: userId,
    status: "approved"
  };
  
  if (startDate || endDate) {
    matchStage.expenseDate = {};
    if (startDate) matchStage.expenseDate.$gte = new Date(startDate);
    if (endDate) matchStage.expenseDate.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalExpenses: { $sum: "$amount" },
        totalTax: { $sum: "$taxAmount" },
        totalWithTax: { $sum: "$totalWithTax" },
        expenseCount: { $sum: 1 },
        averageExpense: { $avg: "$amount" },
        maxExpense: { $max: "$amount" },
        minExpense: { $min: "$amount" }
      }
    }
  ]);
};

// Static method to get expenses by category
expenseSchema.statics.getExpensesByCategory = async function(userId, startDate, endDate) {
  const matchStage = {
    createdBy: userId,
    status: "approved"
  };
  
  if (startDate || endDate) {
    matchStage.expenseDate = {};
    if (startDate) matchStage.expenseDate.$gte = new Date(startDate);
    if (endDate) matchStage.expenseDate.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: "expenseCategories",
        localField: "category",
        foreignField: "_id",
        as: "categoryInfo"
      }
    },
    {
      $group: {
        _id: "$category",
        categoryName: { $first: "$categoryInfo.name" },
        totalAmount: { $sum: "$amount" },
        totalTax: { $sum: "$taxAmount" },
        expenseCount: { $sum: 1 },
        averageAmount: { $avg: "$amount" }
      }
    },
    {
      $sort: { totalAmount: -1 }
    }
  ]);
};

// Static method to get recurring expenses
expenseSchema.statics.getRecurringExpenses = function(userId) {
  return this.find({
    createdBy: userId,
    isRecurring: true,
    status: "approved"
  })
  .populate('category subcategory', 'name code')
  .sort({ nextRecurringDate: 1 });
};

// Static method to get pending expenses
expenseSchema.statics.getPendingExpenses = function(userId) {
  return this.find({
    createdBy: userId,
    status: "pending"
  })
  .populate('category subcategory', 'name code')
  .sort({ createdAt: -1 });
};

// Static method to search expenses
expenseSchema.statics.searchExpenses = function(query, userId, filters = {}) {
  const searchQuery = {
    createdBy: userId,
    ...filters
  };
  
  if (query) {
    searchQuery.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
      { vendor: { $regex: query, $options: "i" } },
      { tags: { $in: [new RegExp(query, "i")] } },
      { reference: { $regex: query, $options: "i" } }
    ];
  }
  
  return this.find(searchQuery)
    .populate('category subcategory', 'name code')
    .sort({ expenseDate: -1 });
};

export default mongoose.model("Expense", expenseSchema);
