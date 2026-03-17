import mongoose from "mongoose";

const saleItemSchema = new mongoose.Schema({
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
  finalPrice: {
    type: Number,
    required: true,
    min: 0
  }
});

const paymentSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ["cash", "card", "transfer", "wallet", "credit", "mixed"],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  reference: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded"],
    default: "completed"
  },
  paidAt: {
    type: Date,
    default: Date.now
  }
});

const saleSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    default: null
  },
  items: [saleItemSchema],
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
    required: true,
    min: 0
  },
  changeAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  payments: [paymentSchema],
  saleType: {
    type: String,
    enum: ["cash", "credit", "mixed"],
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "completed", "cancelled", "refunded"],
    default: "completed"
  },
  isCreditSale: {
    type: Boolean,
    default: false
  },
  creditDueDate: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ""
  },
  cashier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  branch: {
    type: String,
    default: "main"
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
saleSchema.index({ invoiceNumber: 1 });
saleSchema.index({ customer: 1 });
saleSchema.index({ cashier: 1 });
saleSchema.index({ status: 1 });
saleSchema.index({ createdAt: -1 });
saleSchema.index({ createdBy: 1 });

// Pre-save middleware to generate invoice number
saleSchema.pre("save", async function(next) {
  if (!this.invoiceNumber) {
    const count = await this.constructor.countDocuments();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const sequence = String(count + 1).padStart(4, '0');
    this.invoiceNumber = `INV${year}${month}${sequence}`;
  }
  next();
});

// Virtual for balance due
saleSchema.virtual("balanceDue").get(function() {
  return this.totalAmount - this.paidAmount;
});

// Virtual for is fully paid
saleSchema.virtual("isFullyPaid").get(function() {
  return this.paidAmount >= this.totalAmount;
});

// Instance method to add payment
saleSchema.methods.addPayment = function(paymentData) {
  this.payments.push(paymentData);
  this.paidAmount += paymentData.amount;
  
  if (this.paidAmount >= this.totalAmount) {
    this.status = "completed";
    this.changeAmount = this.paidAmount - this.totalAmount;
  }
  
  return this.save();
};

// Instance method to calculate totals
saleSchema.methods.calculateTotals = function() {
  let subtotal = 0;
  
  this.items.forEach(item => {
    const itemTotal = item.quantity * item.unitPrice;
    let discount = 0;
    
    if (item.discountType === "percentage") {
      discount = itemTotal * (item.discount / 100);
    } else {
      discount = item.discount;
    }
    
    item.totalPrice = itemTotal - discount;
    item.finalPrice = item.totalPrice;
    subtotal += item.finalPrice;
  });
  
  this.subtotal = subtotal;
  this.totalAmount = subtotal + this.taxAmount - this.discountAmount;
  
  return this;
};

// Instance method to process sale
saleSchema.methods.processSale = async function() {
  const Product = mongoose.model("Product");
  const StockMovement = mongoose.model("StockMovement");
  const Customer = mongoose.model("Customer");
  
  // Update stock for each item
  for (const item of this.items) {
    const product = await Product.findById(item.product);
    if (!product) {
      throw new Error(`Product not found: ${item.productName}`);
    }
    
    if (product.stock.currentStock < item.quantity) {
      throw new Error(`Insufficient stock for ${item.productName}`);
    }
    
    // Create stock movement
    await StockMovement.createMovement({
      product: item.product,
      type: "out",
      quantity: item.quantity,
      reference: this.invoiceNumber,
      description: `Sale: ${this.invoiceNumber}`,
      reason: "sale",
      createdBy: this.cashier,
      unitCost: product.purchasePrice,
      totalCost: product.purchasePrice * item.quantity
    });
    
    // Update product stock
    await product.updateStock(item.quantity, "subtract");
  }
  
  // Update customer credit if credit sale
  if (this.isCreditSale && this.customer) {
    const customer = await Customer.findById(this.customer);
    if (customer) {
      await customer.updateCredit(this.balanceDue, "add");
      
      // Add loyalty points (1 point per ₦10 spent)
      const points = Math.floor(this.totalAmount / 10);
      await customer.addLoyaltyPoints(points);
    }
  }
  
  this.status = "completed";
  return await this.save();
};

// Static method to get sales summary
saleSchema.statics.getSalesSummary = async function(userId, startDate, endDate) {
  const matchStage = {
    createdBy: userId,
    status: "completed"
  };
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$totalAmount" },
        totalItems: { $sum: { $sum: "$items.quantity" } },
        totalTransactions: { $sum: 1 },
        averageSale: { $avg: "$totalAmount" },
        cashSales: {
          $sum: {
            $cond: [{ $eq: ["$saleType", "cash"] }, "$totalAmount", 0]
          }
        },
        creditSales: {
          $sum: {
            $cond: [{ $eq: ["$saleType", "credit"] }, "$totalAmount", 0]
          }
        }
      }
    }
  ]);
};

// Static method to search sales
saleSchema.statics.searchSales = function(query, userId, filters = {}) {
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
    .populate('customer', 'name phone email')
    .populate('cashier', 'name email')
    .sort({ createdAt: -1 });
};

export default mongoose.model("Sale", saleSchema);
