import mongoose from "mongoose";

const staffSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role",
    required: true
  },
  department: {
    type: String,
    enum: ["sales", "inventory", "management", "finance", "hr", "it", "operations"],
    required: true
  },
  position: {
    type: String,
    required: true,
    trim: true
  },
  hireDate: {
    type: Date,
    required: true
  },
  terminationDate: {
    type: Date,
    default: null
  },
  employmentType: {
    type: String,
    enum: ["full_time", "part_time", "contract", "intern", "temporary"],
    default: "full_time"
  },
  salary: {
    type: Number,
    required: true,
    min: 0
  },
  commissionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  profile: {
    avatar: String,
    bio: String,
    skills: [String],
    qualifications: [String],
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String
    }
  },
  workSchedule: {
    workDays: [{
      type: String,
      enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    }],
    startTime: String,
    endTime: String,
    breakDuration: Number,
    timezone: {
      type: String,
      default: "Africa/Lagos"
    }
  },
  permissions: {
    canManageInventory: { type: Boolean, default: false },
    canManageSales: { type: Boolean, default: false },
    canManageExpenses: { type: Boolean, default: false },
    canManagePurchases: { type: Boolean, default: false },
    canManageReports: { type: Boolean, default: false },
    canManageStaff: { type: Boolean, default: false },
    canManageSettings: { type: Boolean, default: false },
    canViewDashboard: { type: Boolean, default: true }
  },
  status: {
    type: String,
    enum: ["active", "inactive", "suspended", "on_leave"],
    default: "active"
  },
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
  performance: {
    totalSales: { type: Number, default: 0 },
    totalTransactions: { type: Number, default: 0 },
    averageTransactionValue: { type: Number, default: 0 },
    customerSatisfaction: { type: Number, default: 0 },
    attendanceRate: { type: Number, default: 0 },
    performanceScore: { type: Number, default: 0 },
    lastReviewDate: Date
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
staffSchema.index({ email: 1 });
staffSchema.index({ employeeId: 1 });
staffSchema.index({ role: 1 });
staffSchema.index({ department: 1 });
staffSchema.index({ status: 1 });
staffSchema.index({ createdBy: 1 });

// Virtual for full name
staffSchema.virtual("fullName").get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for employment duration
staffSchema.virtual("employmentDuration").get(function() {
  if (!this.hireDate) return 0;
  const now = new Date();
  return Math.floor((now - this.hireDate) / (1000 * 60 * 60 * 24 * 30.44)); // months
});

// Virtual for is currently employed
staffSchema.virtual("isEmployed").get(function() {
  return this.status === "active" && (!this.terminationDate || this.terminationDate > new Date());
});

// Instance method to lock account
staffSchema.methods.lockAccount = function(hours = 24) {
  this.accountLocked = true;
  this.lockedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
  return this.save();
};

// Instance method to unlock account
staffSchema.methods.unlockAccount = function() {
  this.accountLocked = false;
  this.lockedUntil = null;
  this.loginAttempts = 0;
  return this.save();
};

// Instance method to increment login attempts
staffSchema.methods.incrementLoginAttempts = async function() {
  this.loginAttempts += 1;
  
  // Lock after 5 failed attempts
  if (this.loginAttempts >= 5) {
    await this.lockAccount(24);
  } else {
    await this.save();
  }
  
  return this;
};

// Instance method to update performance
staffSchema.methods.updatePerformance = function(performanceData) {
  Object.assign(this.performance, performanceData);
  this.performance.lastReviewDate = new Date();
  return this.save();
};

// Static method to get staff by department
staffSchema.statics.getStaffByDepartment = function(department) {
  return this.find({ department, status: "active" })
    .populate('role', 'name permissions')
    .sort({ lastName: 1, firstName: 1 });
};

// Static method to get staff sales performance
staffSchema.statics.getStaffSalesPerformance = function(startDate, endDate) {
  return this.aggregate([
    { $match: { 
      status: "active",
      department: "sales"
    }},
    {
      $lookup: {
        from: "sales",
        localField: "_id",
        foreignField: "cashier",
        as: "salesData"
      }
    },
    { $unwind: "$salesData" },
    {
      $match: {
        "salesData.createdAt": {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: "$_id",
        totalSales: { $sum: "$salesData.totalAmount" },
        totalTransactions: { $sum: 1 },
        averageTransactionValue: { $avg: "$salesData.totalAmount" }
      }
    },
    {
      $lookup: {
        from: "staff",
        localField: "_id",
        foreignField: "_id",
        as: "staffInfo"
      }
    },
    {
      $project: {
        staffId: "$_id",
        fullName: { $concat: ["$staffInfo.firstName", " ", "$staffInfo.lastName"] },
        email: "$staffInfo.email",
        position: "$staffInfo.position",
        totalSales: 1,
        totalTransactions: 1,
        averageTransactionValue: 1
      }
    }
  ]);
};

// Static method to search staff
staffSchema.statics.searchStaff = function(query, filters = {}) {
  const searchQuery = {
    ...filters,
    $or: [
      { firstName: { $regex: query, $options: "i" } },
      { lastName: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } },
      { employeeId: { $regex: query, $options: "i" } },
      { position: { $regex: query, $options: "i" } }
    ]
  };
  
  return this.find(searchQuery)
    .populate('role', 'name permissions')
    .sort({ lastName: 1, firstName: 1 });
};

export default mongoose.model("Staff", staffSchema);
