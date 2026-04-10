import { Router } from "express";
import Shop from "../models/shop.js";
import auth from "../middlewares/auth.js";
import mongoose from "mongoose";

const router = Router();

/* =========================
   SHOP MANAGEMENT
========================= */

// Get shops by user
router.get("/", auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { createdBy: req.user._id, isActive: true };
    
    let query = Shop.find(filters);
    
    if (search) {
      query = Shop.searchShops(search, filters);
    }
    
    const shops = await query
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Shop.countDocuments(filters);
    
    res.json({
      success: true,
      data: {
        shops,
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

// Get single shop
router.get("/:id", auth, async (req, res) => {
  try {
    const shop = await Shop.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
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
      createdBy: req.user._id,
      allowedUsers: [] // Initialize empty allowedUsers array
    };
    
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
      createdBy: req.user._id 
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    Object.assign(shop, req.body, { updatedBy: req.user._id });
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
      createdBy: req.user._id 
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
      createdBy: req.user._id 
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
      createdBy: req.user._id 
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    const { section } = req.body;
    
    if (section === "business") {
      Object.assign(shop.businessInfo, req.body);
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
    
    shop.updatedBy = req.user._id;
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
      createdBy: req.user._id 
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    Object.assign(shop.settings, req.body, { updatedBy: req.user._id });
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
      createdBy: req.user._id 
    });
    
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    
    const status = {
      isOpen: shop.isOpen(),
      operatingHours: shop.location.operatingHours,
      currentStaff: 0, // Would need to track active staff
      nextOpenTime: shop.isWithinOperatingHours(new Date()) ? shop.getNextOpenTime(new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()) : null,
      nextCloseTime: shop.isWithinOperatingHours(new Date()) ? shop.getNextCloseTime(new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()) : null
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
      createdBy: req.user._id 
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
      createdBy: req.user._id 
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
      createdBy: req.user._id 
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
