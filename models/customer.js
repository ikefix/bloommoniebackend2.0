import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
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
  customerType: {
    type: String,
    enum: ["walk_in", "regular", "vip", "corporate"],
    default: "walk_in"
  },
  creditLimit: {
    type: Number,
    default: 0
  },
  currentCredit: {
    type: Number,
    default: 0
  },
  loyaltyPoints: {
    type: Number,
    default: 0
  },
  discountRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  notes: {
    type: String,
    default: ""
  },
  isActive: {
    type: Boolean,
    default: true
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
customerSchema.index({ phone: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ name: "text" });
customerSchema.index({ createdBy: 1 });

// Virtual for available credit
customerSchema.virtual("availableCredit").get(function() {
  return this.creditLimit - this.currentCredit;
});

// Instance method to check if customer can use credit
customerSchema.methods.canUseCredit = function(amount) {
  return this.availableCredit >= amount;
};

// Instance method to update credit
customerSchema.methods.updateCredit = function(amount, type = "add") {
  if (type === "add") {
    this.currentCredit += amount;
  } else if (type === "subtract") {
    this.currentCredit -= amount;
  }
  return this.save();
};

// Instance method to add loyalty points
customerSchema.methods.addLoyaltyPoints = function(points) {
  this.loyaltyPoints += points;
  return this.save();
};

// Static method to search customers
customerSchema.statics.searchCustomers = function(query, userId) {
  const searchQuery = {
    createdBy: userId,
    isActive: true,
    $or: [
      { name: { $regex: query, $options: "i" } },
      { phone: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } }
    ]
  };
  
  return this.find(searchQuery).sort({ name: 1 });
};

// Static method to get customer by phone
customerSchema.statics.getByPhone = function(phone, userId) {
  return this.findOne({ phone, createdBy: userId, isActive: true });
};

export default mongoose.model("Customer", customerSchema);
