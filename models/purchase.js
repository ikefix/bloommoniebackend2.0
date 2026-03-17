import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema({
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
  batchNumber: {
    type: String,
    default: ""
  },
  expiryDate: {
    type: Date,
    default: null
  }
});

const purchaseSchema = new mongoose.Schema({
  purchaseNumber: {
    type: String,
    required: true,
    unique: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
    required: true
  },
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PurchaseOrder",
    default: null
  },
  items: [purchaseItemSchema],
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
  shippingCost: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "partial", "paid", "overdue"],
    default: "pending"
  },
  paymentDueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ["draft", "confirmed", "received", "cancelled", "returned"],
    default: "draft"
  },
  paymentMethod: {
    type: String,
    enum: ["cash", "transfer", "cheque", "card"],
    default: "transfer"
  },
  notes: {
    type: String,
    default: ""
  },
  supplierInvoice: {
    type: String,
    default: ""
  },
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
purchaseSchema.index({ purchaseNumber: 1 });
purchaseSchema.index({ supplier: 1 });
purchaseSchema.index({ purchaseOrder: 1 });
purchaseSchema.index({ status: 1 });
purchaseSchema.index({ purchaseDate: -1 });
purchaseSchema.index({ createdBy: 1 });

// Pre-save middleware to generate purchase number
purchaseSchema.pre("save", async function(next) {
  if (!this.purchaseNumber) {
    const count = await this.constructor.countDocuments();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const sequence = String(count + 1).padStart(4, '0');
    this.purchaseNumber = `PRC${year}${month}${sequence}`;
  }
  next();
});

// Virtual for balance due
purchaseSchema.virtual("balanceDue").get(function() {
  return this.totalAmount - this.paidAmount;
});

// Instance method to calculate totals
purchaseSchema.methods.calculateTotals = function() {
  let subtotal = 0;
  
  this.items.forEach(item => {
    item.totalPrice = item.quantity * item.unitPrice;
    subtotal += item.totalPrice;
  });
  
  this.subtotal = subtotal;
  this.totalAmount = subtotal + this.taxAmount + this.shippingCost - this.discountAmount;
  
  return this;
};

// Instance method to receive purchase
purchaseSchema.methods.receivePurchase = async function(userId) {
  const Product = mongoose.model("Product");
  const StockMovement = mongoose.model("StockMovement");
  
  // Update stock for each item
  for (const item of this.items) {
    const product = await Product.findById(item.product);
    if (!product) {
      throw new Error(`Product not found: ${item.productName}`);
    }
    
    // Create stock movement
    await StockMovement.createMovement({
      product: item.product,
      type: "in",
      quantity: item.quantity,
      reference: this.purchaseNumber,
      description: `Purchase: ${this.purchaseNumber}`,
      reason: "purchase",
      createdBy: userId,
      unitCost: item.unitPrice,
      totalCost: item.totalPrice
    });
    
    // Update product stock
    await product.updateStock(item.quantity, "add");
    
    // Update purchase price if different
    if (item.unitPrice !== product.purchasePrice) {
      product.purchasePrice = item.unitPrice;
      await product.save();
    }
  }
  
  this.status = "received";
  return await this.save();
};

// Static method to get purchase summary
purchaseSchema.statics.getPurchaseSummary = async function(userId, startDate, endDate) {
  const matchStage = {
    createdBy: userId,
    status: "received"
  };
  
  if (startDate || endDate) {
    matchStage.purchaseDate = {};
    if (startDate) matchStage.purchaseDate.$gte = new Date(startDate);
    if (endDate) matchStage.purchaseDate.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalPurchases: { $sum: "$totalAmount" },
        totalItems: { $sum: { $sum: "$items.quantity" } },
        totalTransactions: { $sum: 1 },
        averagePurchase: { $avg: "$totalAmount" }
      }
    }
  ]);
};

// Static method to get overdue purchases
purchaseSchema.statics.getOverduePurchases = function(userId) {
  const today = new Date();
  return this.find({
    createdBy: userId,
    paymentStatus: { $in: ["pending", "partial"] },
    paymentDueDate: { $lt: today },
    status: { $ne: "cancelled" }
  })
  .populate('supplier', 'name phone email')
  .populate('items.product', 'name sku')
  .sort({ paymentDueDate: 1 });
};

export default mongoose.model("Purchase", purchaseSchema);
