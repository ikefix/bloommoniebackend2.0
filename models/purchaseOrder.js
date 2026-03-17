import mongoose from "mongoose";

const purchaseOrderItemSchema = new mongoose.Schema({
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
  receivedQuantity: {
    type: Number,
    default: 0
  },
  pendingQuantity: {
    type: Number,
    default: 0
  }
});

const purchaseOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
    required: true
  },
  items: [purchaseOrderItemSchema],
  subtotal: {
    type: Number,
    required: true,
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
  orderDate: {
    type: Date,
    required: true
  },
  expectedDeliveryDate: {
    type: Date,
    required: true
  },
  actualDeliveryDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ["draft", "sent", "confirmed", "partial", "received", "cancelled"],
    default: "draft"
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium"
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
  supplierReference: {
    type: String,
    default: ""
  },
  internalReference: {
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
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
purchaseOrderSchema.index({ orderNumber: 1 });
purchaseOrderSchema.index({ supplier: 1 });
purchaseOrderSchema.index({ status: 1 });
purchaseOrderSchema.index({ orderDate: -1 });
purchaseOrderSchema.index({ createdBy: 1 });

// Pre-save middleware to generate order number
purchaseOrderSchema.pre("save", async function(next) {
  if (!this.orderNumber) {
    const count = await this.constructor.countDocuments();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const sequence = String(count + 1).padStart(4, '0');
    this.orderNumber = `PO${year}${month}${sequence}`;
  }
  next();
});

// Virtual for total received
purchaseOrderSchema.virtual("totalReceived").get(function() {
  return this.items.reduce((sum, item) => sum + item.receivedQuantity, 0);
});

// Virtual for total pending
purchaseOrderSchema.virtual("totalPending").get(function() {
  return this.items.reduce((sum, item) => sum + item.pendingQuantity, 0);
});

// Virtual for is fully received
purchaseOrderSchema.virtual("isFullyReceived").get(function() {
  return this.items.every(item => item.receivedQuantity >= item.quantity);
});

// Instance method to calculate totals
purchaseOrderSchema.methods.calculateTotals = function() {
  let subtotal = 0;
  
  this.items.forEach(item => {
    item.totalPrice = item.quantity * item.unitPrice;
    item.pendingQuantity = item.quantity - item.receivedQuantity;
    subtotal += item.totalPrice;
  });
  
  this.subtotal = subtotal;
  this.totalAmount = subtotal + this.taxAmount + this.shippingCost;
  
  return this;
};

// Instance method to receive items
purchaseOrderSchema.methods.receiveItems = async function(receivedItems, receivedBy) {
  receivedItems.forEach(receivedItem => {
    const item = this.items.id(receivedItem.itemId);
    if (item) {
      item.receivedQuantity += receivedItem.quantity;
      item.pendingQuantity = item.quantity - item.receivedQuantity;
    }
  });
  
  // Check if all items are received
  if (this.isFullyReceived) {
    this.status = "received";
    this.actualDeliveryDate = new Date();
  } else {
    this.status = "partial";
  }
  
  this.receivedBy = receivedBy;
  return await this.save();
};

// Instance method to send order
purchaseOrderSchema.methods.sendOrder = function(approvedBy) {
  this.status = "sent";
  this.approvedBy = approvedBy;
  return this.save();
};

// Static method to get pending orders
purchaseOrderSchema.statics.getPendingOrders = function(userId) {
  return this.find({ 
    createdBy: userId,
    status: { $in: ["draft", "sent", "confirmed", "partial"] }
  })
  .populate('supplier', 'name phone email')
  .populate('items.product', 'name sku')
  .sort({ orderDate: -1 });
};

// Static method to search orders
purchaseOrderSchema.statics.searchOrders = function(query, userId, filters = {}) {
  const searchQuery = {
    createdBy: userId,
    ...filters
  };
  
  if (query) {
    searchQuery.$or = [
      { orderNumber: { $regex: query, $options: "i" } },
      { supplierReference: { $regex: query, $options: "i" } },
      { internalReference: { $regex: query, $options: "i" } }
    ];
  }
  
  return this.find(searchQuery)
    .populate('supplier', 'name phone email')
    .populate('items.product', 'name sku')
    .sort({ orderDate: -1 });
};

export default mongoose.model("PurchaseOrder", purchaseOrderSchema);
