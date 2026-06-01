import mongoose from "mongoose";
const unitSchema = new mongoose.Schema({
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
    baseUnit: {
        type: String,
        required: true
    },
    conversionFactor: {
        type: Number,
        required: true,
        default: 1
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
// code and name already have unique: true, so no need for additional index
// Instance method to convert to base unit
unitSchema.methods.convertToBase = function (quantity) {
    return quantity * this.conversionFactor;
};
// Instance method to convert from base unit
unitSchema.methods.convertFromBase = function (baseQuantity) {
    return baseQuantity / this.conversionFactor;
};
// Static method to get all units
unitSchema.statics.getAllUnits = function () {
    return this.find({ isActive: true }).sort({ name: 1 });
};
export default mongoose.model("Unit", unitSchema);
