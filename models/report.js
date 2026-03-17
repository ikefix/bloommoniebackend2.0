import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ["sales", "inventory", "expense", "profit_loss", "wallet", "credit_sales", "savings", "staff_performance", "custom"],
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  parameters: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    filters: {
      category: String,
      subcategory: String,
      product: String,
      customer: String,
      supplier: String,
      staff: String,
      paymentMethod: String,
      department: String,
      location: String,
      tags: [String]
    },
    groupBy: {
      type: String,
      enum: ["day", "week", "month", "quarter", "year", "category", "product", "customer", "staff", "department"]
    },
    sortBy: {
      type: String,
      enum: ["date", "amount", "quantity", "name"],
      default: "date"
    },
    sortOrder: {
      type: String,
      enum: ["asc", "desc"],
      default: "desc"
    },
    limit: {
      type: Number,
      default: 100
    },
    format: {
      type: String,
      enum: ["json", "csv", "pdf", "excel"],
      default: "json"
    }
  },
  schedule: {
    isScheduled: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
      default: null
    },
    nextRun: {
      type: Date,
      default: null
    },
    recipients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],
    emailSubject: String,
    emailTemplate: String,
    isActive: {
      type: Boolean,
      default: true
    }
  },
  data: {
    generatedAt: {
      type: Date,
      default: Date.now
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    fileUrl: String,
    filePath: String,
    recordCount: Number,
    totalAmount: Number,
    format: String,
    size: Number,
    checksum: String
  },
  template: {
    name: String,
    description: String,
    layout: {
      type: String,
      enum: ["standard", "detailed", "summary", "custom"],
      default: "standard"
    },
    headers: [{
      key: String,
      label: String,
      width: Number,
      alignment: {
        type: String,
        enum: ["left", "center", "right"],
        default: "left"
      },
      format: {
        type: String,
        default: "text"
      }
    }],
    footer: String,
    css: String
  },
  access: {
    isPublic: {
      type: Boolean,
      default: false
    },
    allowedRoles: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role"
    }],
    allowedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],
    password: String,
    expiresAt: Date,
    downloadLimit: {
      type: Number,
      default: 1
    }
  },
  isActive: {
    type: Boolean,
    default: true
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
reportSchema.index({ type: 1 });
reportSchema.index({ createdBy: 1 });
reportSchema.index({ isActive: 1 });
reportSchema.index({ "schedule.nextRun": 1 });
reportSchema.index({ "data.generatedAt": -1 });

// Virtual for report status
reportSchema.virtual("status").get(function() {
  if (this.schedule.isScheduled && this.schedule.nextRun > new Date()) {
    return "scheduled";
  }
  if (this.data.generatedAt) {
    return "generated";
  }
  return "draft";
});

// Virtual for is expired
reportSchema.virtual("isExpired").get(function() {
  return this.access.expiresAt && this.access.expiresAt < new Date();
});

// Instance method to generate report
reportSchema.methods.generateReport = async function(userId) {
  const ReportGenerator = mongoose.model('ReportGenerator');
  
  try {
    const reportData = await ReportGenerator.generateReport(this);
    
    this.data.generatedAt = new Date();
    this.data.generatedBy = userId;
    this.data.recordCount = reportData.recordCount;
    this.data.totalAmount = reportData.totalAmount;
    this.data.fileUrl = reportData.fileUrl;
    this.data.filePath = reportData.filePath;
    this.data.format = this.parameters.format;
    this.data.size = reportData.size;
    this.data.checksum = reportData.checksum;
    
    await this.save();
    
    return {
      success: true,
      report: this,
      data: reportData
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Instance method to schedule report
reportSchema.methods.scheduleReport = function(frequency, recipients) {
  this.schedule.isScheduled = true;
  this.schedule.frequency = frequency;
  this.schedule.recipients = recipients;
  this.schedule.nextRun = this.calculateNextRun(frequency);
  
  return this.save();
};

// Helper method to calculate next run time
reportSchema.methods.calculateNextRun = function(frequency) {
  const now = new Date();
  let nextRun = new Date(now);
  
  switch (frequency) {
    case "daily":
      nextRun.setDate(now.getDate() + 1);
      break;
    case "weekly":
      nextRun.setDate(now.getDate() + 7);
      break;
    case "monthly":
      nextRun.setMonth(now.getMonth() + 1);
      break;
    case "quarterly":
      nextRun.setMonth(now.getMonth() + 3);
      break;
    case "yearly":
      nextRun.setFullYear(now.getFullYear() + 1);
      break;
  }
  
  return nextRun;
};

// Static method to get reports by type
reportSchema.statics.getReportsByType = function(type, userId) {
  return this.find({ 
    type, 
    createdBy: userId,
    isActive: true 
  })
  .sort({ createdAt: -1 })
  .populate('generatedBy', 'name email')
  .populate('schedule.recipients', 'name email');
};

// Static method to get scheduled reports
reportSchema.statics.getScheduledReports = function(userId) {
  return this.find({
    createdBy: userId,
    "schedule.isScheduled": true,
    "schedule.isActive": true,
    "schedule.nextRun": { $lte: new Date() }
  })
  .sort({ "schedule.nextRun": 1 })
  .populate('generatedBy', 'name email')
  .populate('schedule.recipients', 'name email');
};

// Static method to get report templates
reportSchema.statics.getReportTemplates = function(type) {
  const templates = {
    sales: {
      name: "Sales Report",
      description: "Comprehensive sales analysis",
      layout: "detailed",
      headers: [
        { key: "date", label: "Date", width: 100, alignment: "left" },
        { key: "invoice", label: "Invoice", width: 120, alignment: "left" },
        { key: "customer", label: "Customer", width: 150, alignment: "left" },
        { key: "product", label: "Product", width: 200, alignment: "left" },
        { key: "quantity", label: "Quantity", width: 80, alignment: "center", format: "number" },
        { key: "unitPrice", label: "Unit Price", width: 100, alignment: "right", format: "currency" },
        { key: "totalPrice", label: "Total Price", width: 120, alignment: "right", format: "currency" }
      ]
    },
    inventory: {
      name: "Inventory Report",
      description: "Stock levels and movements",
      layout: "detailed",
      headers: [
        { key: "product", label: "Product", width: 200, alignment: "left" },
        { key: "sku", label: "SKU", width: 100, alignment: "left" },
        { key: "currentStock", label: "Current Stock", width: 100, alignment: "center", format: "number" },
        { key: "minimumStock", label: "Min Stock", width: 100, alignment: "center", format: "number" },
        { key: "reorderPoint", label: "Reorder Point", width: 100, alignment: "center", format: "number" },
        { key: "status", label: "Status", width: 100, alignment: "center" }
      ]
    },
    expense: {
      name: "Expense Report",
      description: "Expense analysis by category",
      layout: "summary",
      headers: [
        { key: "category", label: "Category", width: 150, alignment: "left" },
        { key: "totalAmount", label: "Total Amount", width: 120, alignment: "right", format: "currency" },
        { key: "expenseCount", label: "Count", width: 80, alignment: "center", format: "number" },
        { key: "averageAmount", label: "Average", width: 120, alignment: "right", format: "currency" },
        { key: "budgetLimit", label: "Budget", width: 100, alignment: "right", format: "currency" }
      ]
    },
    profit_loss: {
      name: "Profit & Loss",
      description: "Financial performance summary",
      layout: "detailed",
      headers: [
        { key: "category", label: "Category", width: 150, alignment: "left" },
        { key: "income", label: "Income", width: 120, alignment: "right", format: "currency" },
        { key: "expenses", label: "Expenses", width: 120, alignment: "right", format: "currency" },
        { key: "profit", label: "Profit", width: 120, alignment: "right", format: "currency" },
        { key: "margin", label: "Margin", width: 100, alignment: "right", format: "percentage" }
      ]
    }
  };
  
  return templates[type] || templates.sales;
};

// Static method to create default reports
reportSchema.statics.createDefaultReports = async function(userId) {
  const templates = {
    sales: {
      name: "Daily Sales Report",
      type: "sales",
      description: "Daily sales summary",
      parameters: {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(),
        groupBy: "day",
        sortBy: "date",
        sortOrder: "desc"
      },
      schedule: {
        isScheduled: true,
        frequency: "daily",
        recipients: [userId]
      },
      createdBy: userId
    },
    inventory: {
      name: "Weekly Inventory Report",
      type: "inventory",
      description: "Weekly stock levels",
      parameters: {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        groupBy: "category"
      },
      schedule: {
        isScheduled: true,
        frequency: "weekly",
        recipients: [userId]
      },
      createdBy: userId
    },
    expense: {
      name: "Monthly Expense Report",
      type: "expense",
      description: "Monthly expense analysis",
      parameters: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        groupBy: "category"
      },
      schedule: {
        isScheduled: true,
        frequency: "monthly",
        recipients: [userId]
      },
      createdBy: userId
    },
    profit_loss: {
      name: "Monthly Profit & Loss",
      type: "profit_loss",
      description: "Monthly financial performance",
      parameters: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        groupBy: "month"
      },
      schedule: {
        isScheduled: true,
        frequency: "monthly",
        recipients: [userId]
      },
      createdBy: userId
    }
  };
  
  for (const report of Object.values(templates)) {
    await new Report(report).save();
  }
  
  return templates;
};

export default mongoose.model("Report", reportSchema);
