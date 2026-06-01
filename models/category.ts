import mongoose from "mongoose";

// Document interface (instance methods)
export interface ICategoryDocument extends Document {
  name: string;
  description: string;
  code: string;
  parentId?: mongoose.Types.ObjectId | null;
  image: string;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  assignedShop?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  getFullPath(): Promise<string>;
}

// Model interface (static methods)
export interface ICategoryModel extends mongoose.Model<ICategoryDocument> {
  getCategoryTree(): any;
  getRootCategories(): any;
  searchAndSetImage(categoryName: string): Promise<string>;
}

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
  },
  assignedShop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
// code and name already have unique: true, so no need for additional index
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

// Static method to search and set image for a category
categorySchema.statics.searchAndSetImage = async function(categoryName: string): Promise<string> {
  try {
    const imageSearchService = (await import('../service/imageSearchService.js')).default;
    const images = await imageSearchService.searchImages(categoryName, 1);
    return images.length > 0 ? images[0] : "";
  } catch (error) {
    console.error('Error searching for category image:', error);
    return "";
  }
};

export default mongoose.model<ICategoryDocument, ICategoryModel>("Category", categorySchema);
