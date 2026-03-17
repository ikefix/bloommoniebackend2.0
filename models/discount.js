import mongoose from "mongoose";

const discountSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true
  },
  type: {
    type: String,
    enum: ["percentage", "fixed", "buy_x_get_y", "category_discount"],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  minimumAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  maximumDiscount: {
    type: Number,
    default: null
  },
  applicableProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product"
  }],
  applicableCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category"
  }],
  buyXGetY: {
    buyQuantity: Number,
    getYQuantity: Number,
    getYProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    }
  },
  usageLimit: {
    type: Number,
    default: null
  },
  usageCount: {
    type: Number,
    default: 0
  },
  userUsageLimit: {
    type: Number,
    default: 1
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isAutoApply: {
    type: Boolean,
    default: false
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
discountSchema.index({ code: 1 });
discountSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
discountSchema.index({ createdBy: 1 });

// Virtual for is currently valid
discountSchema.virtual("isValid").get(function() {
  const now = new Date();
  return this.isActive && now >= this.startDate && now <= this.endDate;
});

// Virtual for remaining usage
discountSchema.virtual("remainingUsage").get(function() {
  if (!this.usageLimit) return null;
  return this.usageLimit - this.usageCount;
});

// Instance method to check if can be applied
discountSchema.methods.canBeApplied = function(cartTotal, userId = null) {
  // Check if discount is valid
  if (!this.isValid) {
    return { valid: false, reason: "Discount is not active or expired" };
  }
  
  // Check minimum amount
  if (cartTotal < this.minimumAmount) {
    return { 
      valid: false, 
      reason: `Minimum purchase amount of ₦${this.minimumAmount} required` 
    };
  }
  
  // Check usage limit
  if (this.usageLimit && this.usageCount >= this.usageLimit) {
    return { valid: false, reason: "Discount usage limit reached" };
  }
  
  return { valid: true };
};

// Instance method to calculate discount
discountSchema.methods.calculateDiscount = function(cartTotal, cartItems = []) {
  if (!this.isValid) return 0;
  
  let discountAmount = 0;
  
  switch (this.type) {
    case "percentage":
      discountAmount = cartTotal * (this.value / 100);
      break;
    case "fixed":
      discountAmount = Math.min(this.value, cartTotal);
      break;
    case "category_discount":
      const applicableItems = cartItems.filter(item => 
        this.applicableCategories.includes(item.category)
      );
      const categoryTotal = applicableItems.reduce((sum, item) => sum + item.totalPrice, 0);
      discountAmount = categoryTotal * (this.value / 100);
      break;
    case "buy_x_get_y":
      // This would need more complex logic in the POS system
      discountAmount = 0;
      break;
  }
  
  // Apply maximum discount limit
  if (this.maximumDiscount) {
    discountAmount = Math.min(discountAmount, this.maximumDiscount);
  }
  
  return discountAmount;
};

// Instance method to increment usage
discountSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

// Static method to find valid discounts
discountSchema.statics.findValidDiscounts = function(userId = null) {
  const now = new Date();
  return this.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  }).populate('applicableProducts applicableCategories');
};

// Static method to get discount by code
discountSchema.statics.getByCode = function(code, userId = null) {
  return this.findOne({ 
    code: code.toUpperCase(),
    isActive: true
  }).populate('applicableProducts applicableCategories');
};

export default mongoose.model("Discount", discountSchema);
