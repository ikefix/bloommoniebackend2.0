import mongoose from "mongoose";

const shopSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ["retail", "wholesale", "restaurant", "service", "ecommerce", "manufacturing"],
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  businessInfo: {
    businessName: {
      type: String,
      default: ""
    },
    businessType: {
      type: String,
      enum: ["sole_proprietorship", "partnership", "corporation", "llc"],
      default: ""
    },
    registrationNumber: {
      type: String,
      default: ""
    },
    taxId: {
      type: String,
      default: ""
    },
    businessLicense: {
      type: String,
      default: ""
    },
    vatNumber: {
      type: String,
      default: ""
    },
    website: {
      type: String,
      default: ""
    },
    email: {
      type: String,
      required: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true
    }
  },
  address: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: "Nigeria"
    },
    zipCode: {
      type: String,
      required: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  location: {
    name: String,
    description: String,
    area: Number,
    seatingCapacity: Number,
    parkingSpaces: Number,
    hasStorage: Boolean,
    hasDeliveryService: Boolean,
    operatingHours: {
      monday: { open: String, close: String },
      tuesday: { open: String, close: String },
      wednesday: { open: String, close: String },
      thursday: { open: String, close: String },
      friday: { open: String, close: String },
      saturday: { open: String, close: String },
      sunday: { open: String, close: String }
    }
  },
  settings: {
    currency: {
      type: String,
      required: true,
      default: "NGN"
    },
    timezone: {
      type: String,
      required: true,
      default: "Africa/Lagos"
    },
    dateFormat: {
      type: String,
      enum: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"],
      default: "DD/MM/YYYY"
    },
    taxSettings: {
      taxEnabled: { type: Boolean, default: true },
      taxRate: { type: Number, default: 7.5 },
      taxIncluded: { type: Boolean, default: false }
    },
    receiptSettings: {
      showLogo: { type: Boolean, default: true },
      showBusinessInfo: { type: Boolean, default: true },
      showCustomerInfo: { type: Boolean, default: true },
      showTaxDetails: { type: Boolean, default: true },
      showPaymentDetails: { type: Boolean, default: true },
      footerText: { type: String, default: "Thank you for your business!" }
    },
    paymentMethods: [{
      type: { type: String, required: true },
      name: { type: String, required: true },
      isActive: { type: Boolean, default: true },
      fee: { type: Number, default: 0 }
    }],
    securitySettings: {
      requireLoginForSales: { type: Boolean, default: true },
      requireLoginForReports: { type: Boolean, default: true },
      requireLoginForInventory: { type: Boolean, default: true },
      sessionTimeout: { type: Number, default: 30 },
      maxLoginAttempts: { type: Number, default: 5 },
      passwordComplexity: { type: Boolean, default: true }
    }
  },
  branding: {
    logo: String,
    primaryColor: { type: String, default: "#007bff" },
    secondaryColor: { type: String, default: "#6c757d" },
    accentColor: { type: String, default: "#28a745" },
    fontFamily: { type: String, default: "Arial" },
    customCSS: String
  },
  integrations: {
    posSystem: {
      enabled: { type: Boolean, default: false },
      provider: { type: String, enum: ["custom", "square", "clover", "poynt"] },
      apiKey: String,
      locationId: String
    },
    paymentGateway: {
      enabled: { type: Boolean, default: false },
      provider: { type: String, enum: ["paystack", "flutterwave", "stripe", "paypal"] },
      publicKey: String,
      secretKey: String
    },
    accountingSoftware: {
      enabled: { type: Boolean, default: false },
      provider: { type: String, enum: ["quickbooks", "xero", "sage"] },
      apiKey: String
    },
    emailService: {
      enabled: { type: Boolean, default: false },
      provider: { type: String, enum: ["sendgrid", "mailgun", "ses", "smtp"] },
      apiKey: String,
      fromEmail: String
    },
    smsService: {
      enabled: { type: Boolean, default: false },
      provider: { type: String, enum: ["twilio", "africastalking", "termii"] },
      apiKey: String,
      fromNumber: String
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
shopSchema.index({ code: 1 });
shopSchema.index({ createdBy: 1 });
shopSchema.index({ isActive: 1 });
shopSchema.index({ "location.coordinates": "2dsphere" });

// Virtual for full address
shopSchema.virtual("fullAddress").get(function() {
  const parts = [
    this.address.street,
    this.address.city,
    this.address.state,
    this.address.country,
    this.address.zipCode
  ].filter(Boolean);
  
  return parts.join(", ");
});

// Virtual for is currently open
shopSchema.virtual("isOpen").get(function() {
  if (!this.location.operatingHours) return false;
  
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentTime = now.toTimeString().slice(0, 5);
  
  const todayHours = this.location.operatingHours[currentDay];
  if (!todayHours) return false;
  
  return currentTime >= todayHours.open && currentTime <= todayHours.close;
});

// Instance method to check if within operating hours
shopSchema.methods.isWithinOperatingHours = function(date = new Date()) {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const hours = this.location.operatingHours[dayName];
  
  if (!hours) return { isOpen: false, nextOpenTime: null, nextCloseTime: null };
  
  const currentTime = date.toTimeString().slice(0, 5);
  const isOpen = currentTime >= hours.open && currentTime <= hours.close;
  
  return {
    isOpen,
    nextOpenTime: !isOpen ? this.getNextOpenTime(dayName) : null,
    nextCloseTime: isOpen ? this.getNextCloseTime(dayName) : null
  };
};

// Helper method to get next open time
shopSchema.methods.getNextOpenTime = function(dayName) {
  // Implementation for getting next open time
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return this.location.operatingHours[dayName]?.open || null;
};

// Helper method to get next close time
shopSchema.methods.getNextCloseTime = function(dayName) {
  // Implementation for getting next close time
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return this.location.operatingHours[dayName]?.close || null;
};

// Static method to get shops by user
shopSchema.statics.getShopsByUser = function(userId) {
  return this.find({ createdBy: userId, isActive: true })
    .sort({ name: 1 });
};

// Static method to search shops
shopSchema.statics.searchShops = function(query, userId) {
  const searchQuery = {
    createdBy: userId,
    isActive: true,
    $or: [
      { name: { $regex: query, $options: "i" } },
      { code: { $regex: query, $options: "i" } },
      { "businessInfo.businessName": { $regex: query, $options: "i" } },
      { "address.city": { $regex: query, $options: "i" } },
      { "address.state": { $regex: query, $options: "i" } }
    ]
  };
  
  return this.find(searchQuery).sort({ name: 1 });
};

export default mongoose.model("Shop", shopSchema);
