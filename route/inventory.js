import { Router } from "express";
import Product from "../models/product.js";
import Category from "../models/category.js";
import Brand from "../models/brand.js";
import Unit from "../models/unit.js";
import StockMovement from "../models/stockMovement.js";
import StockTransfer from "../models/stockTransfer.js";
import auth from "../middlewares/auth.js";
import mongoose from "mongoose";

const router = Router();

/* =========================
   PRODUCT MANAGEMENT
========================= */

// Get all products with pagination and filters
router.get("/products", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      category, 
      brand, 
      status,
      sortBy = "name",
      sortOrder = "asc"
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { 
      isActive: true,
      createdBy: req.user._id 
    };
    
    if (category) filters.category = category;
    if (brand) filters.brand = brand;
    if (status === "low_stock") {
      filters["stock.currentStock"] = { $lte: "$stock.reorderPoint" };
    } else if (status === "out_of_stock") {
      filters["stock.currentStock"] = 0;
    }
    
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;
    
    let query = Product.find(filters).populate('category brand unit');
    
    if (search) {
      query = Product.searchProducts(search, filters);
    }
    
    const products = await query
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Product.countDocuments(filters);
    
    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          limit: parseInt(limit)
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get single product
router.get("/products/:id", auth, async (req, res) => {
  try {
    const product = await Product.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    })
      .populate('category brand unit createdBy lastUpdatedBy');
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    // Get recent stock movements
    const movements = await StockMovement.getProductMovements(product._id, { limit: 10 });
    
    res.json({
      success: true,
      data: {
        product,
        movements
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Create new product
router.post("/products", auth, async (req, res) => {
  try {
    const productData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Generate SKU if not provided
    if (!productData.sku) {
      const count = await Product.countDocuments();
      productData.sku = `PRD${String(count + 1).padStart(6, '0')}`;
    }
    
    const product = new Product(productData);
    await product.save();
    
    await Product.findById(product._id).populate('category brand unit');
    
    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Product SKU or barcode already exists" });
    }
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update product
router.put("/products/:id", auth, async (req, res) => {
  try {
    const product = await Product.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    Object.assign(product, req.body, { lastUpdatedBy: req.user._id });
    await product.save();
    
    await Product.findById(product._id).populate('category brand unit');
    
    res.json({
      success: true,
      message: "Product updated successfully",
      data: product
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Product SKU or barcode already exists" });
    }
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Delete product (soft delete)
router.delete("/products/:id", auth, async (req, res) => {
  try {
    const product = await Product.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    product.isActive = false;
    product.lastUpdatedBy = req.user._id;
    await product.save();
    
    res.json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   CATEGORY MANAGEMENT
========================= */

// Get category tree
router.get("/categories", auth, async (req, res) => {
  try {
    const categories = await Category.find({ createdBy: req.user._id, isActive: true })
      .populate('parentId', 'name code');
    
    const buildTree = (categories, parentId = null) => {
      return categories
        .filter(cat => String(cat.parentId) === String(parentId))
        .map(cat => ({
          ...cat.toObject(),
          children: buildTree(categories, cat._id)
        }));
    };
    
    const categoryTree = buildTree(categories);
    
    res.json({
      success: true,
      data: categoryTree
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get root categories
router.get("/categories/root", auth, async (req, res) => {
  try {
    const categories = await Category.find({ 
      parentId: null, 
      createdBy: req.user._id, 
      isActive: true 
    }).sort({ name: 1 });
    
    res.json({
      success: true,
      data: categories
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Create category
router.post("/categories", auth, async (req, res) => {
  try {
    const categoryData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Generate category code if not provided
    if (!categoryData.code) {
      const count = await Category.countDocuments();
      categoryData.code = `CAT${String(count + 1).padStart(3, '0')}`;
    }
    
    const category = new Category(categoryData);
    await category.save();
    
    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Category code or name already exists" });
    }
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update category
router.put("/categories/:id", auth, async (req, res) => {
  try {
    const category = await Category.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    Object.assign(category, req.body);
    await category.save();
    
    res.json({
      success: true,
      message: "Category updated successfully",
      data: category
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Delete category
router.delete("/categories/:id", auth, async (req, res) => {
  try {
    const category = await Category.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    // Check if category has products
    const productCount = await Product.countDocuments({ 
      category: category._id, 
      isActive: true,
      createdBy: req.user._id 
    });
    if (productCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete category with associated products" 
      });
    }
    
    // Check if category has subcategories
    const subcategoryCount = await Category.countDocuments({ 
      parentId: category._id, 
      isActive: true,
      createdBy: req.user._id 
    });
    if (subcategoryCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete category with subcategories" 
      });
    }
    
    category.isActive = false;
    await category.save();
    
    res.json({
      success: true,
      message: "Category deleted successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   BRAND MANAGEMENT
========================= */

// Get all brands
router.get("/brands", auth, async (req, res) => {
  try {
    const brands = await Brand.find({ isActive: true })
      .sort({ name: 1 });
    
    res.json({
      success: true,
      data: brands
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Create brand
router.post("/brands", auth, async (req, res) => {
  try {
    const brandData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Generate brand code if not provided
    if (!brandData.code) {
      const count = await Brand.countDocuments();
      brandData.code = `BRD${String(count + 1).padStart(3, '0')}`;
    }
    
    const brand = new Brand(brandData);
    await brand.save();
    
    res.status(201).json({
      success: true,
      message: "Brand created successfully",
      data: brand
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Brand code or name already exists" });
    }
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update brand
router.put("/brands/:id", auth, async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    
    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }
    
    Object.assign(brand, req.body);
    await brand.save();
    
    res.json({
      success: true,
      message: "Brand updated successfully",
      data: brand
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Delete brand
router.delete("/brands/:id", auth, async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    
    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }
    
    // Check if brand has products
    const productCount = await Product.countDocuments({ brand: brand._id, isActive: true });
    if (productCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete brand with associated products" 
      });
    }
    
    brand.isActive = false;
    await brand.save();
    
    res.json({
      success: true,
      message: "Brand deleted successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   UNIT MANAGEMENT
========================= */

// Get all units
router.get("/units", auth, async (req, res) => {
  try {
    const units = await Unit.getAllUnits();
    
    res.json({
      success: true,
      data: units
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Create unit
router.post("/units", auth, async (req, res) => {
  try {
    const unitData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Generate unit code if not provided
    if (!unitData.code) {
      const count = await Unit.countDocuments();
      unitData.code = `UNT${String(count + 1).padStart(3, '0')}`;
    }
    
    const unit = new Unit(unitData);
    await unit.save();
    
    res.status(201).json({
      success: true,
      message: "Unit created successfully",
      data: unit
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Unit code or name already exists" });
    }
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   STOCK MANAGEMENT
========================= */

// Get low stock alerts
router.get("/stock/low-stock", auth, async (req, res) => {
  try {
    const products = await Product.getLowStockProducts();
    
    res.json({
      success: true,
      data: products
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get out of stock products
router.get("/stock/out-of-stock", auth, async (req, res) => {
  try {
    const products = await Product.getOutOfStockProducts();
    
    res.json({
      success: true,
      data: products
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Stock adjustment
router.post("/stock/adjustment", auth, async (req, res) => {
  try {
    const { productId, quantity, reason, description } = req.body;
    
    if (!productId || !quantity || !reason) {
      return res.status(400).json({ 
        message: "Product ID, quantity, and reason are required" 
      });
    }
    
    const movement = await StockMovement.createMovement({
      product: productId,
      type: "adjustment",
      quantity,
      reference: `ADJ${Date.now()}`,
      description: description || `Stock adjustment: ${reason}`,
      reason: "adjustment",
      createdBy: req.user._id
    });
    
    await StockMovement.findById(movement._id).populate('product', 'name sku');
    
    res.json({
      success: true,
      message: "Stock adjusted successfully",
      data: movement
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get stock movements for a product
router.get("/stock/movements/:productId", auth, async (req, res) => {
  try {
    const { limit = 50, page = 1, type } = req.query;
    const skip = (page - 1) * limit;
    
    const filters = {};
    if (type) filters.type = type;
    
    const movements = await StockMovement.getProductMovements(
      req.params.productId, 
      filters
    ).skip(skip).limit(parseInt(limit));
    
    const totalCount = await StockMovement.countDocuments({
      product: req.params.productId,
      ...filters
    });
    
    res.json({
      success: true,
      data: {
        movements,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          limit: parseInt(limit)
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   STOCK TRANSFER
========================= */

// Create stock transfer
router.post("/stock/transfer", auth, async (req, res) => {
  try {
    const transferData = {
      ...req.body,
      initiatedBy: req.user._id
    };
    
    const transfer = new StockTransfer(transferData);
    await transfer.save();
    
    await StockTransfer.findById(transfer._id).populate('items.product', 'name sku');
    
    res.status(201).json({
      success: true,
      message: "Stock transfer created successfully",
      data: transfer
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get pending transfers
router.get("/stock/transfer/pending", auth, async (req, res) => {
  try {
    const transfers = await StockTransfer.getPendingTransfers();
    
    res.json({
      success: true,
      data: transfers
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Approve transfer
router.post("/stock/transfer/:id/approve", auth, async (req, res) => {
  try {
    const transfer = await StockTransfer.findById(req.params.id);
    
    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }
    
    if (transfer.status !== "pending") {
      return res.status(400).json({ 
        message: "Transfer cannot be approved" 
      });
    }
    
    await transfer.approveTransfer(req.user._id);
    await StockTransfer.findById(transfer._id).populate('items.product', 'name sku');
    
    res.json({
      success: true,
      message: "Transfer approved successfully",
      data: transfer
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Complete transfer
router.post("/stock/transfer/:id/complete", auth, async (req, res) => {
  try {
    const transfer = await StockTransfer.findById(req.params.id);
    
    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }
    
    if (transfer.status !== "in_transit") {
      return res.status(400).json({ 
        message: "Transfer cannot be completed" 
      });
    }
    
    await transfer.completeTransfer(req.user._id);
    await StockTransfer.findById(transfer._id).populate('items.product', 'name sku');
    
    res.json({
      success: true,
      message: "Transfer completed successfully",
      data: transfer
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Cancel transfer
router.post("/stock/transfer/:id/cancel", auth, async (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ message: "Cancellation reason is required" });
    }
    
    const transfer = await StockTransfer.findById(req.params.id);
    
    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }
    
    if (transfer.status === "completed") {
      return res.status(400).json({ 
        message: "Cannot cancel completed transfer" 
      });
    }
    
    await transfer.cancelTransfer(reason);
    
    res.json({
      success: true,
      message: "Transfer cancelled successfully",
      data: transfer
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get transfer history
router.get("/stock/transfer/history", auth, async (req, res) => {
  try {
    const { status, location } = req.query;
    const filters = {};
    
    if (status) filters.status = status;
    if (location) {
      filters.$or = [
        { fromLocation: location },
        { toLocation: location }
      ];
    }
    
    const transfers = await StockTransfer.getTransferHistory(filters);
    
    res.json({
      success: true,
      data: transfers
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   DASHBOARD & REPORTS
========================= */

// Get inventory dashboard data
router.get("/dashboard", auth, async (req, res) => {
  try {
    const [
      totalProducts,
      lowStockCount,
      outOfStockCount,
      totalCategories,
      totalBrands,
      recentMovements
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ 
        isActive: true, 
        "stock.currentStock": { $gt: 0, $lte: mongoose.Schema.Types.Decimal128("$stock.reorderPoint") }
      }),
      Product.countDocuments({ 
        isActive: true, 
        "stock.currentStock": 0 
      }),
      Category.countDocuments({ isActive: true }),
      Brand.countDocuments({ isActive: true }),
      StockMovement.find({})
        .populate('product', 'name sku')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);
    
    // Get stock value
    const stockValue = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalStockValue: { $sum: { $multiply: ["$stock.currentStock", "$purchasePrice"] } },
          totalRetailValue: { $sum: { $multiply: ["$stock.currentStock", "$sellingPrice"] } }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        summary: {
          totalProducts,
          lowStockCount,
          outOfStockCount,
          totalCategories,
          totalBrands,
          stockValue: stockValue[0] || { totalStockValue: 0, totalRetailValue: 0 }
        },
        recentMovements
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
