import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    default: ""
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null
  },
  image: {
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
categorySchema.index({ code: 1 });
categorySchema.index({ name: 1 });
categorySchema.index({ parentId: 1 });

// Static method to get category tree
categorySchema.statics.getCategoryTree = async function() {
  const categories = await this.find({ isActive: true }).populate('parentId', 'name code');
  
  const buildTree = (categories, parentId = null) => {
    return categories
      .filter(cat => String(cat.parentId) === String(parentId))
      .map(cat => ({
        ...cat.toObject(),
        children: buildTree(categories, cat._id)
      }));
  };
  
  return buildTree(categories);
};

// Static method to get root categories
categorySchema.statics.getRootCategories = function() {
  return this.find({ parentId: null, isActive: true }).sort({ name: 1 });
};

// Instance method to get full path
categorySchema.methods.getFullPath = async function() {
  const path = [];
  let current = this;
  
  while (current) {
    path.unshift(current.name);
    if (current.parentId) {
      current = await this.constructor.findById(current.parentId);
    } else {
      break;
    }
  }
  
  return path.join(' > ');
};

export default mongoose.model("Category", categorySchema);
