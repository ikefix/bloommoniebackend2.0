import mongoose from "mongoose";

const invoiceItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  sku: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unit: {
    type: String,
    required: true
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountType: {
    type: String,
    enum: ["percentage", "fixed"],
    default: "percentage"
  },
  taxRate: {
    type: Number,
    default: 7.5,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  }
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ["sale", "purchase", "service", "credit_note", "debit_note"],
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    default: null
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
    default: null
  },
  items: [invoiceItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  balanceDue: {
    type: Number,
    required: true,
    min: 0
  },
  invoiceDate: {
    type: Date,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ["draft", "sent", "paid", "overdue", "cancelled", "credited"],
    default: "draft"
  },
  paymentTerms: {
    type: String,
    enum: ["cash", "net_7", "net_14", "net_30", "net_60", "net_90"],
    default: "net_30"
  },
  notes: {
    type: String,
    default: ""
  },
  terms: {
    type: String,
    default: ""
  },
  currency: {
    type: String,
    default: "NGN"
  },
  exchangeRate: {
    type: Number,
    default: 1
  },
  attachments: [{
    filename: String,
    url: String,
    type: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ customer: 1 });
invoiceSchema.index({ supplier: 1 });
invoiceSchema.index({ type: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ createdBy: 1 });

// Pre-save middleware to generate invoice number
invoiceSchema.pre("save", async function(next) {
  if (!this.invoiceNumber) {
    const count = await this.constructor.countDocuments();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const sequence = String(count + 1).padStart(4, '0');
    
    if (this.type === "sale") {
      this.invoiceNumber = `INV${year}${month}${sequence}`;
    } else if (this.type === "purchase") {
      this.invoiceNumber = `PINV${year}${month}${sequence}`;
    } else {
      this.invoiceNumber = `DOC${year}${month}${sequence}`;
    }
  }
  next();
});

// Virtual for is overdue
invoiceSchema.virtual("isOverdue").get(function() {
  return new Date() > this.dueDate && this.status !== "paid" && this.status !== "cancelled";
});

// Virtual for days overdue
invoiceSchema.virtual("daysOverdue").get(function() {
  if (!this.isOverdue) return 0;
  const today = new Date();
  const diffTime = Math.abs(today - this.dueDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance method to calculate totals
invoiceSchema.methods.calculateTotals = function() {
  let subtotal = 0;
  let totalTax = 0;
  
  this.items.forEach(item => {
    const itemTotal = item.quantity * item.unitPrice;
    let discount = 0;
    
    if (item.discountType === "percentage") {
      discount = itemTotal * (item.discount / 100);
    } else {
      discount = item.discount;
    }
    
    const discountedTotal = itemTotal - discount;
    item.taxAmount = discountedTotal * (item.taxRate / 100);
    item.totalPrice = discountedTotal + item.taxAmount;
    
    subtotal += discountedTotal;
    totalTax += item.taxAmount;
  });
  
  this.subtotal = subtotal;
  this.taxAmount = totalTax;
  this.totalAmount = subtotal + totalTax - this.discountAmount;
  this.balanceDue = this.totalAmount - this.paidAmount;
  
  return this;
};

// Instance method to add payment
invoiceSchema.methods.addPayment = function(amount, paymentMethod, reference = "") {
  this.paidAmount += amount;
  this.balanceDue = this.totalAmount - this.paidAmount;
  
  if (this.paidAmount >= this.totalAmount) {
    this.status = "paid";
  } else if (this.paidAmount > 0) {
    this.status = "sent";
  }
  
  return this.save();
};

// Instance method to send invoice
invoiceSchema.methods.sendInvoice = function(approvedBy) {
  this.status = "sent";
  this.approvedBy = approvedBy;
  return this.save();
};

// Static method to get overdue invoices
invoiceSchema.statics.getOverdueInvoices = function(userId) {
  return this.find({
    createdBy: userId,
    status: { $in: ["sent", "overdue"] },
    dueDate: { $lt: new Date() }
  })
  .populate('customer supplier', 'name phone email')
  .populate('items.product', 'name sku')
  .sort({ dueDate: 1 });
};

// Static method to search invoices
invoiceSchema.statics.searchInvoices = function(query, userId, filters = {}) {
  const searchQuery = {
    createdBy: userId,
    ...filters
  };
  
  if (query) {
    searchQuery.$or = [
      { invoiceNumber: { $regex: query, $options: "i" } },
      { "items.productName": { $regex: query, $options: "i" } },
      { "items.sku": { $regex: query, $options: "i" } }
    ];
  }
  
  return this.find(searchQuery)
    .populate('customer supplier', 'name phone email')
    .populate('items.product', 'name sku')
    .sort({ invoiceDate: -1 });
};

// Static method to get invoice summary
invoiceSchema.statics.getInvoiceSummary = async function(userId, startDate, endDate) {
  const matchStage = {
    createdBy: userId,
    status: { $in: ["sent", "paid", "overdue"] }
  };
  
  if (startDate || endDate) {
    matchStage.invoiceDate = {};
    if (startDate) matchStage.invoiceDate.$gte = new Date(startDate);
    if (endDate) matchStage.invoiceDate.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$type",
        totalAmount: { $sum: "$totalAmount" },
        paidAmount: { $sum: "$paidAmount" },
        balanceDue: { $sum: "$balanceDue" },
        count: { $sum: 1 }
      }
    }
  ]);
};

export default mongoose.model("Invoice", invoiceSchema);
