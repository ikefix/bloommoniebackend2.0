import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  contactPerson: {
    name: String,
    phone: String,
    email: String
  },
  businessType: {
    type: String,
    enum: ["individual", "company", "corporation"],
    default: "company"
  },
  taxId: {
    type: String,
    default: ""
  },
  paymentTerms: {
    type: String,
    enum: ["cash", "net_7", "net_14", "net_30", "net_60", "net_90"],
    default: "net_30"
  },
  creditLimit: {
    type: Number,
    default: 0
  },
  currentBalance: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: ""
  },
  products: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    },
    supplierSku: String,
    purchasePrice: Number,
    minimumOrder: Number,
    leadTime: Number,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
supplierSchema.index({ code: 1 });
supplierSchema.index({ name: "text" });
supplierSchema.index({ phone: 1 });
supplierSchema.index({ email: 1 });
supplierSchema.index({ createdBy: 1 });
supplierSchema.index({ isActive: 1 });

// Virtual for available credit
supplierSchema.virtual("availableCredit").get(function() {
  return this.creditLimit - this.currentBalance;
});

// Virtual for total products
supplierSchema.virtual("totalProducts").get(function() {
  return this.products.filter(p => p.isActive).length;
});

// Instance method to add product
supplierSchema.methods.addProduct = function(productData) {
  this.products.push(productData);
  return this.save();
};

// Instance method to update balance
supplierSchema.methods.updateBalance = function(amount, type = "add") {
  if (type === "add") {
    this.currentBalance += amount;
  } else if (type === "subtract") {
    this.currentBalance -= amount;
  }
  return this.save();
};

// Static method to search suppliers
supplierSchema.statics.searchSuppliers = function(query, userId) {
  const searchQuery = {
    createdBy: userId,
    isActive: true,
    $or: [
      { name: { $regex: query, $options: "i" } },
      { code: { $regex: query, $options: "i" } },
      { phone: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } }
    ]
  };
  
  return this.find(searchQuery).sort({ name: 1 });
};

// Static method to get suppliers with products
supplierSchema.statics.getSuppliersWithProducts = function(userId) {
  return this.find({ 
    createdBy: userId, 
    isActive: true 
  })
  .populate('products.product', 'name sku')
  .sort({ name: 1 });
};

export default mongoose.model("Supplier", supplierSchema);
