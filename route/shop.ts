import { Router } from "express";
import Shop from "../models/shop.js";
import auth from "../middlewares/auth.js";
import mongoose from "mongoose";

const router = Router();

/* =========================
   PUBLIC ROUTES (NO AUTH)
========================= */

// Get all shop IDs (no auth required)
router.get("/public/all-ids", async (req, res) => {
  try {
    const shops = await Shop.find({}, { _id: 1, name: 1, code: 1 });
    const shopIds = shops.map(shop => ({
      id: shop._id,
      name: shop.name,
      code: shop.code
    }));
    
    res.json({
      success: true,
      data: shopIds,
      count: shopIds.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Delete shop by ID (no auth required)
router.delete("/public/:id", async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    await Shop.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: "Shop deleted successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   SHOP MANAGEMENT
========================= */

// Get shops by user
router.get("/", auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    const pageNum = typeof page === 'number' ? page : parseInt(page as string) || 1;
    const limitNum = typeof limit === 'number' ? limit : parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;
    const filters: any = { createdBy: req.user.id, isActive: true };
    
    let query = Shop.find(filters);
    
    if (search) {
      query = (Shop as any).searchShops(search as string, filters);
    }
    
    const shops = await query
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum);
    
    const totalCount = await Shop.countDocuments(filters);
    
    res.json({
      success: true,
      data: {
        shops,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount,
          limit: limitNum
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get single shop
router.get("/:id", auth, async (req, res) => {
  try {
    const shop = await Shop.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id 
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    res.json({
      success: true,
      data: shop
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Create shop
router.post("/", auth, async (req, res) => {
  try {
    const shopData = {
      ...req.body,
      createdBy: req.user.id,
      allowedUsers: [] // Initialize empty allowedUsers array
    };
    
    // Remove empty strings from businessInfo to preserve schema defaults
    if (shopData.businessInfo) {
      Object.keys(shopData.businessInfo).forEach(key => {
        if (shopData.businessInfo[key] === '') {
          delete shopData.businessInfo[key];
        }
      });
    }
    
    // Generate shop code if not provided
    if (!shopData.code) {
      const count = await Shop.countDocuments();
      shopData.code = `SHOP${String(count + 1).padStart(4, '0')}`;
    }
    
    const shop = new Shop(shopData);
    await shop.save();
    
    res.status(201).json({
      success: true,
      message: "Shop created successfully",
      data: shop
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Shop code already exists" });
    }
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update shop
router.put("/:id", auth, async (req, res) => {
  try {
    const shop = await Shop.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id 
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    // Remove empty strings from businessInfo to preserve schema defaults
    const updateData = { ...req.body };
    if (updateData.businessInfo) {
      Object.keys(updateData.businessInfo).forEach(key => {
        if (updateData.businessInfo[key] === '') {
          delete updateData.businessInfo[key];
        }
      });
    }
    
    Object.assign(shop, updateData, { updatedBy: new mongoose.Types.ObjectId(req.user.id as string) });
    await shop.save();
    
    res.json({
      success: true,
      message: "Shop updated successfully",
      data: shop
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Delete shop
router.delete("/:id", auth, async (req, res) => {
  try {
    const shop = await Shop.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id 
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    shop.isActive = false;
    await shop.save();
    
    res.json({
      success: true,
      message: "Shop deleted successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   SHOP PROFILE
========================= */

// Get shop profile
router.get("/:id/profile", auth, async (req, res) => {
  try {
    const shop = await Shop.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id 
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    res.json({
      success: true,
      data: {
        businessInfo: shop.businessInfo,
        address: shop.address,
        location: shop.location,
        settings: shop.settings,
        branding: shop.branding,
        integrations: shop.integrations
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update shop profile
router.put("/:id/profile", auth, async (req, res) => {
  try {
    const shop = await Shop.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id 
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    const { section } = req.body;
    
    if (section === "business") {
      // Remove empty strings from businessInfo to preserve schema defaults
      const businessData = { ...req.body };
      Object.keys(businessData).forEach(key => {
        if (businessData[key] === '') {
          delete businessData[key];
        }
      });
      Object.assign(shop.businessInfo, businessData);
    } else if (section === "address") {
      Object.assign(shop.address, req.body);
    } else if (section === "location") {
      Object.assign(shop.location, req.body);
    } else if (section === "settings") {
      Object.assign(shop.settings, req.body);
    } else if (section === "branding") {
      Object.assign(shop.branding, req.body);
    } else if (section === "integrations") {
      Object.assign(shop.integrations, req.body);
    } else {
      return res.status(400).json({ message: "Invalid section" });
    }
    
    shop.updatedBy = new mongoose.Types.ObjectId(req.user.id as string);
    await shop.save();
    
    res.json({
      success: true,
      message: "Shop profile updated successfully",
      data: shop
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   SHOP SETTINGS
========================= */

// Update shop settings
router.put("/:id/settings", auth, async (req, res) => {
  try {
    const shop = await Shop.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id 
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    Object.assign(shop.settings, req.body, { updatedBy: new mongoose.Types.ObjectId(req.user.id as string) });
    await shop.save();
    
    res.json({
      success: true,
      message: "Shop settings updated successfully",
      data: shop
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   SHOP OPERATIONS
========================= */

// Get shop status
router.get("/:id/status", auth, async (req, res) => {
  try {
    const shop = await Shop.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id 
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    const status = {
      isOpen: (shop as any).isOpen(),
      operatingHours: shop.location.operatingHours,
      currentStaff: 0, // Would need to track active staff
      nextOpenTime: (shop as any).isWithinOperatingHours(new Date()) ? (shop as any).getNextOpenTime(new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()) : null,
      nextCloseTime: (shop as any).isWithinOperatingHours(new Date()) ? (shop as any).getNextCloseTime(new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()) : null
    };
    
    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Open shop
router.post("/:id/open", auth, async (req, res) => {
  try {
    const shop = await Shop.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id 
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    // Update shop status to open (would need to track in real system)
    res.json({
      success: true,
      message: "Shop opened successfully",
      data: { isOpen: true }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Close shop
router.post("/:id/close", auth, async (req, res) => {
  try {
    const shop = await Shop.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id 
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    // Update shop status to closed (would need to track in real system)
    res.json({
      success: true,
      message: "Shop closed successfully",
      data: { isOpen: false }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   SHOP ANALYTICS
========================= */

// Get shop analytics
router.get("/:id/analytics", auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      period 
    } = req.query;
    
    const shop = await Shop.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id 
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    // This would integrate with sales and inventory data
    const analytics = {
      totalSales: 0, // Would calculate from sales data
      totalExpenses: 0, // Would calculate from expense data
      profit: 0, // Would calculate from sales and expenses
      topProducts: [], // Would calculate from sales data
      busyHours: [], // Would calculate from operating hours
      customerSatisfaction: 0 // Would calculate from customer data
    };
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
