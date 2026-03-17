import mongoose from "mongoose";

const expenseCategorySchema = new mongoose.Schema({
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
  description: {
    type: String,
    default: ""
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ExpenseCategory",
    default: null
  },
  budgetLimit: {
    type: Number,
    default: 0,
    min: 0
  },
  alertThreshold: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  color: {
    type: String,
    default: "#007bff"
  },
  icon: {
    type: String,
    default: "fas fa-tag"
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
expenseCategorySchema.index({ code: 1 });
expenseCategorySchema.index({ name: 1 });
expenseCategorySchema.index({ parentCategory: 1 });
expenseCategorySchema.index({ createdBy: 1 });
expenseCategorySchema.index({ isActive: 1 });

// Virtual for full path
expenseCategorySchema.virtual("fullPath").get(function() {
  const buildPath = async (category) => {
    const path = [category.name];
    if (category.parentCategory) {
      const parent = await this.constructor.findById(category.parentCategory);
      if (parent) {
        const parentPath = await buildPath(parent);
        path.unshift(...parentPath);
      }
    }
    return path;
  };
  
  return buildPath(this);
});

// Static method to get category tree
expenseCategorySchema.statics.getCategoryTree = async function(userId) {
  const categories = await this.find({ 
    createdBy: userId,
    isActive: true 
  }).populate('parentCategory', 'name code');
  
  const buildTree = (categories, parentId = null) => {
    return categories
      .filter(cat => String(cat.parentCategory) === String(parentId))
      .map(cat => ({
        ...cat.toObject(),
        children: buildTree(categories, cat._id)
      }));
  };
  
  return buildTree(categories);
};

// Static method to get root categories
expenseCategorySchema.statics.getRootCategories = function(userId) {
  return this.find({ 
    parentCategory: null, 
    createdBy: userId,
    isActive: true 
  }).sort({ name: 1 });
};

// Static method to search categories
expenseCategorySchema.statics.searchCategories = function(query, userId) {
  const searchQuery = {
    createdBy: userId,
    isActive: true,
    $or: [
      { name: { $regex: query, $options: "i" } },
      { code: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } }
    ]
  };
  
  return this.find(searchQuery).sort({ name: 1 });
};

export default mongoose.model("ExpenseCategory", expenseCategorySchema);
