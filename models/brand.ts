import mongoose from "mongoose";

const brandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  description: {
    type: String,
    default: ""
  },
  logo: {
    type: String,
    default: ""
  },
  website: {
    type: String,
    default: ""
  },
  contactEmail: {
    type: String,
    default: ""
  },
  contactPhone: {
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

// Index for efficient queries
brandSchema.index({ code: 1 });
brandSchema.index({ name: 1 });

export default mongoose.model("Brand", brandSchema);
