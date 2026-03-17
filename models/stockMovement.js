import mongoose from "mongoose";

const stockMovementSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  type: {
    type: String,
    enum: ["in", "out", "adjustment", "transfer_in", "transfer_out"],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  reference: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  previousStock: {
    type: Number,
    required: true
  },
  newStock: {
    type: Number,
    required: true
  },
  unitCost: {
    type: Number,
    default: 0
  },
  totalCost: {
    type: Number,
    default: 0
  },
  location: {
    type: String,
    default: "main"
  },
  transferLocation: {
    type: String,
    default: null
  },
  reason: {
    type: String,
    enum: ["purchase", "sale", "return", "damage", "theft", "adjustment", "transfer", "other"],
    default: "other"
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
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "approved"
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
stockMovementSchema.index({ product: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });
stockMovementSchema.index({ reference: 1 });
stockMovementSchema.index({ createdBy: 1 });

// Static method to create stock movement
stockMovementSchema.statics.createMovement = async function(data) {
  const Product = mongoose.model('Product');
  const product = await Product.findById(data.product);
  
  if (!product) {
    throw new Error("Product not found");
  }
  
  const previousStock = product.stock.currentStock;
  let newStock = previousStock;
  
  switch (data.type) {
    case "in":
    case "transfer_in":
      newStock = previousStock + data.quantity;
      break;
    case "out":
    case "transfer_out":
      if (previousStock < data.quantity) {
        throw new Error("Insufficient stock");
      }
      newStock = previousStock - data.quantity;
      break;
    case "adjustment":
      newStock = data.quantity;
      break;
  }
  
  // Create movement record
  const movement = new this({
    ...data,
    previousStock,
    newStock,
    totalCost: data.unitCost * data.quantity
  });
  
  // Update product stock
  await product.updateStock(newStock - previousStock, "set");
  
  return await movement.save();
};

// Static method to get product movements
stockMovementSchema.statics.getProductMovements = function(productId, filters = {}) {
  const query = { product: productId, ...filters };
  return this.find(query)
    .populate('product', 'name sku')
    .populate('createdBy', 'name email')
    .populate('approvedBy', 'name email')
    .sort({ createdAt: -1 });
};

// Static method to get stock summary
stockMovementSchema.statics.getStockSummary = function(productId, startDate, endDate) {
  const matchStage = { product: mongoose.Types.ObjectId(productId) };
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$type",
        totalQuantity: { $sum: "$quantity" },
        totalCost: { $sum: "$totalCost" },
        count: { $sum: 1 }
      }
    }
  ]);
};

export default mongoose.model("StockMovement", stockMovementSchema);
