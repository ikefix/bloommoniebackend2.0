import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true
  },
  description: {
    type: String,
    default: ""
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Brand",
    default: null
  },
  unit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Unit",
    required: true
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  wholesalePrice: {
    type: Number,
    min: 0
  },
  images: [{
    type: String
  }],
  specifications: {
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    color: String,
    size: String,
    material: String
  },
  stock: {
    currentStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    minimumStock: {
      type: Number,
      required: true,
      default: 10,
      min: 0
    },
    maximumStock: {
      type: Number,
      default: 1000
    },
    reorderPoint: {
      type: Number,
      required: true,
      default: 5,
      min: 0
    },
    reorderQuantity: {
      type: Number,
      required: true,
      default: 50,
      min: 1
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isTrackable: {
    type: Boolean,
    default: true
  },
  isPerishable: {
    type: Boolean,
    default: false
  },
  expiryDate: {
    type: Date,
    default: null
  },
  tags: [{
    type: String,
    trim: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
productSchema.index({ sku: 1 });
productSchema.index({ barcode: 1 });
productSchema.index({ name: "text", description: "text" });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ "stock.currentStock": 1 });
productSchema.index({ isActive: 1 });

// Virtual for profit margin
productSchema.virtual("profitMargin").get(function() {
  if (this.sellingPrice && this.purchasePrice) {
    return ((this.sellingPrice - this.purchasePrice) / this.sellingPrice * 100).toFixed(2);
  }
  return 0;
});

// Virtual for stock status
productSchema.virtual("stockStatus").get(function() {
  const current = this.stock.currentStock;
  const minimum = this.stock.minimumStock;
  const reorder = this.stock.reorderPoint;
  
  if (current === 0) return "out_of_stock";
  if (current <= reorder) return "reorder_needed";
  if (current <= minimum) return "low_stock";
  return "in_stock";
});

// Instance method to check if stock is low
productSchema.methods.isLowStock = function() {
  return this.stock.currentStock <= this.stock.reorderPoint;
};

// Instance method to check if out of stock
productSchema.methods.isOutOfStock = function() {
  return this.stock.currentStock === 0;
};

// Instance method to update stock
productSchema.methods.updateStock = function(quantity, type = "add") {
  if (type === "add") {
    this.stock.currentStock += quantity;
  } else if (type === "subtract") {
    if (this.stock.currentStock >= quantity) {
      this.stock.currentStock -= quantity;
    } else {
      throw new Error("Insufficient stock");
    }
  } else if (type === "set") {
    this.stock.currentStock = quantity;
  }
  return this.save();
};

// Static method to get low stock products
productSchema.statics.getLowStockProducts = function() {
  return this.find({
    isActive: true,
    "stock.currentStock": { $lte: "$stock.reorderPoint" }
  }).populate('category brand unit');
};

// Static method to get out of stock products
productSchema.statics.getOutOfStockProducts = function() {
  return this.find({
    isActive: true,
    "stock.currentStock": 0
  }).populate('category brand unit');
};

// Static method to search products
productSchema.statics.searchProducts = function(query, filters = {}) {
  const searchQuery = {
    isActive: true,
    ...filters
  };
  
  if (query) {
    searchQuery.$or = [
      { name: { $regex: query, $options: "i" } },
      { sku: { $regex: query, $options: "i" } },
      { barcode: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } }
    ];
  }
  
  return this.find(searchQuery)
    .populate('category brand unit')
    .sort({ name: 1 });
};

export default mongoose.model("Product", productSchema);
