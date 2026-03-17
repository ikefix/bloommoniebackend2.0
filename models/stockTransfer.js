import mongoose from "mongoose";

const stockTransferSchema = new mongoose.Schema({
  transferNumber: {
    type: String,
    required: true,
    unique: true
  },
  fromLocation: {
    type: String,
    required: true
  },
  toLocation: {
    type: String,
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
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
    reason: {
      type: String,
      default: ""
    }
  }],
  status: {
    type: String,
    enum: ["pending", "in_transit", "completed", "cancelled"],
    default: "pending"
  },
  initiatedBy: {
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
  },
  notes: {
    type: String,
    default: ""
  },
  expectedDeliveryDate: {
    type: Date,
    default: null
  },
  actualDeliveryDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
stockTransferSchema.index({ transferNumber: 1 });
stockTransferSchema.index({ status: 1 });
stockTransferSchema.index({ fromLocation: 1, toLocation: 1 });
stockTransferSchema.index({ initiatedBy: 1 });

// Pre-save middleware to generate transfer number
stockTransferSchema.pre("save", async function(next) {
  if (!this.transferNumber) {
    const count = await this.constructor.countDocuments();
    this.transferNumber = `TRF${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Instance method to approve transfer
stockTransferSchema.methods.approveTransfer = async function(approvedBy) {
  const StockMovement = mongoose.model('StockMovement');
  const Product = mongoose.model('Product');
  
  // Check stock availability
  for (const item of this.items) {
    const product = await Product.findById(item.product);
    if (product.stock.currentStock < item.quantity) {
      throw new Error(`Insufficient stock for product: ${product.name}`);
    }
  }
  
  // Create outbound movements
  for (const item of this.items) {
    await StockMovement.createMovement({
      product: item.product,
      type: "transfer_out",
      quantity: item.quantity,
      reference: this.transferNumber,
      description: `Transfer to ${this.toLocation}`,
      reason: "transfer",
      createdBy: this.initiatedBy,
      location: this.fromLocation,
      transferLocation: this.toLocation
    });
  }
  
  this.status = "in_transit";
  this.approvedBy = approvedBy;
  
  return await this.save();
};

// Instance method to complete transfer
stockTransferSchema.methods.completeTransfer = async function(receivedBy) {
  const StockMovement = mongoose.model('StockMovement');
  
  // Create inbound movements
  for (const item of this.items) {
    await StockMovement.createMovement({
      product: item.product,
      type: "transfer_in",
      quantity: item.quantity,
      reference: this.transferNumber,
      description: `Transfer from ${this.fromLocation}`,
      reason: "transfer",
      createdBy: receivedBy,
      location: this.toLocation,
      transferLocation: this.fromLocation
    });
  }
  
  this.status = "completed";
  this.receivedBy = receivedBy;
  this.actualDeliveryDate = new Date();
  
  return await this.save();
};

// Instance method to cancel transfer
stockTransferSchema.methods.cancelTransfer = async function(reason) {
  const StockMovement = mongoose.model('StockMovement');
  
  // Reverse outbound movements if any were made
  for (const item of this.items) {
    await StockMovement.createMovement({
      product: item.product,
      type: "adjustment",
      quantity: item.quantity,
      reference: this.transferNumber,
      description: `Cancelled transfer: ${reason}`,
      reason: "adjustment",
      createdBy: this.initiatedBy,
      location: this.fromLocation
    });
  }
  
  this.status = "cancelled";
  this.notes = this.notes ? `${this.notes} - Cancelled: ${reason}` : `Cancelled: ${reason}`;
  
  return await this.save();
};

// Static method to get pending transfers
stockTransferSchema.statics.getPendingTransfers = function() {
  return this.find({ status: "pending" })
    .populate('items.product', 'name sku')
    .populate('initiatedBy', 'name email')
    .sort({ createdAt: -1 });
};

// Static method to get transfer history
stockTransferSchema.statics.getTransferHistory = function(filters = {}) {
  return this.find(filters)
    .populate('items.product', 'name sku')
    .populate('initiatedBy approvedBy receivedBy', 'name email')
    .sort({ createdAt: -1 });
};

export default mongoose.model("StockTransfer", stockTransferSchema);
