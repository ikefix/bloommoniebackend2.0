import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "cashier", "manager"],
      default: "cashier",
    },

    phone: {
      type: String,
      required: true,
      unique: true,
    },

    verified: {
      type: Boolean,
      default: false,
    },

    verificationToken: {
      type: String,
      default: null,
    },

    otp: {
      type: String,
      default: null,
    },

    subscription: {
      type: String,
      enum: ["free", "basic", "lite", "business"],
      default: "free",
    },

    termsAndConditionsAccepted: {
      type: Boolean,
      default: false,
    },
    
    walletBalance: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);