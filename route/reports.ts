import { Router } from "express";
import Report, { IReportDocument } from "../models/report.js";
import Staff from "../models/staff.js";
import Sale from "../models/sale.js";
import Product from "../models/product.js";
import Expense from "../models/expense.js";
import auth from "../middlewares/auth.js";
import mongoose from "mongoose";
import { redisClient } from "../app.js";

const router = Router();

/* =========================
   SALES REPORT
========================= */

// Generate sales report
router.post("/sales", auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      groupBy = "day",
      format = "json",
      filters = {} 
    } = req.body;
    
    // Create cache key
    const cacheKey = `report:sales:${req.user._id}:${startDate}:${endDate}:${groupBy}:${JSON.stringify(filters)}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        message: "Sales report retrieved from cache",
        data: JSON.parse(cached.toString()),
        cached: true
      });
    }
    
    const report = new Report({
      name: "Sales Report",
      type: "sales",
      description: "Comprehensive sales analysis",
      parameters: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        groupBy,
        format,
        filters
      },
      createdBy: req.user._id
    });
    
    const result = await (report as unknown as IReportDocument).generateReport(new mongoose.Types.ObjectId(req.user._id as string));
    
    // Cache result for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(result));
    
    res.json({
      success: true,
      message: "Sales report generated successfully",
      data: result,
      cached: false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   INVENTORY REPORT
========================= */

// Generate inventory report
router.post("/inventory", auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      includeZeroStock = false,
      format = "json",
      filters = {} 
    } = req.body;
    
    // Create cache key
    const cacheKey = `report:inventory:${req.user._id}:${startDate}:${endDate}:${includeZeroStock}:${JSON.stringify(filters)}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        message: "Inventory report retrieved from cache",
        data: JSON.parse(cached.toString()),
        cached: true
      });
    }
    
    const report = new Report({
      name: "Inventory Report",
      type: "inventory",
      description: "Stock levels and movements",
      parameters: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        includeZeroStock,
        format,
        filters
      },
      createdBy: req.user._id
    });
    
    const result = await (report as unknown as IReportDocument).generateReport(new mongoose.Types.ObjectId(req.user._id as string));
    
    // Cache result for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(result));
    
    res.json({
      success: true,
      message: "Inventory report generated successfully",
      data: result,
      cached: false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   EXPENSE REPORT
========================= */

// Generate expense report
router.post("/expense", auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      groupBy = "category",
      includePending = false,
      format = "json",
      filters = {} 
    } = req.body;
    
    // Create cache key
    const cacheKey = `report:expense:${req.user._id}:${startDate}:${endDate}:${groupBy}:${includePending}:${JSON.stringify(filters)}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        message: "Expense report retrieved from cache",
        data: JSON.parse(cached.toString()),
        cached: true
      });
    }
    
    const report = new Report({
      name: "Expense Report",
      type: "expense",
      description: "Expense analysis by category",
      parameters: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        groupBy,
        includePending,
        format,
        filters
      },
      createdBy: req.user._id
    });
    
    const result = await (report as unknown as IReportDocument).generateReport(new mongoose.Types.ObjectId(req.user._id as string));
    
    // Cache result for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(result));
    
    res.json({
      success: true,
      message: "Expense report generated successfully",
      data: result,
      cached: false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   PROFIT & LOSS REPORT
========================= */

// Generate profit & loss report
router.post("/profit-loss", auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      format = "json",
      filters = {} 
    } = req.body;
    
    // Create cache key
    const cacheKey = `report:profit-loss:${req.user._id}:${startDate}:${endDate}:${JSON.stringify(filters)}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        message: "Profit & Loss report retrieved from cache",
        data: JSON.parse(cached.toString()),
        cached: true
      });
    }
    
    const report = new Report({
      name: "Profit & Loss Report",
      type: "profit_loss",
      description: "Financial performance analysis",
      parameters: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        format,
        filters
      },
      createdBy: req.user._id
    });
    
    const result = await (report as unknown as IReportDocument).generateReport(new mongoose.Types.ObjectId(req.user._id as string));
    
    // Cache result for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(result));
    
    res.json({
      success: true,
      message: "Profit & Loss report generated successfully",
      data: result,
      cached: false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   WALLET REPORT
========================= */

// Generate wallet report
router.post("/wallet", auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      format = "json",
      filters = {} 
    } = req.body;
    
    // Create cache key
    const cacheKey = `report:wallet:${req.user._id}:${startDate}:${endDate}:${JSON.stringify(filters)}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        message: "Wallet report retrieved from cache",
        data: JSON.parse(cached.toString()),
        cached: true
      });
    }
    
    const report = new Report({
      name: "Wallet Report",
      type: "wallet",
      description: "Wallet transactions and balance analysis",
      parameters: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        format,
        filters
      },
      createdBy: req.user._id
    });
    
    const result = await (report as unknown as IReportDocument).generateReport(new mongoose.Types.ObjectId(req.user._id as string));
    
    // Cache result for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(result));
    
    res.json({
      success: true,
      message: "Wallet report generated successfully",
      data: result,
      cached: false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   CREDIT SALES REPORT
========================= */

// Generate credit sales report
router.post("/credit-sales", auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      includeOverdue = true,
      format = "json",
      filters = {} 
    } = req.body;
    
    // Create cache key
    const cacheKey = `report:credit-sales:${req.user._id}:${startDate}:${endDate}:${includeOverdue}:${JSON.stringify(filters)}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        message: "Credit sales report retrieved from cache",
        data: JSON.parse(cached.toString()),
        cached: true
      });
    }
    
    const report = new Report({
      name: "Credit Sales Report",
      type: "credit_sales",
      description: "Credit sales analysis and overdue tracking",
      parameters: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        includeOverdue,
        format,
        filters
      },
      createdBy: req.user._id
    });
    
    const result = await (report as unknown as IReportDocument).generateReport(new mongoose.Types.ObjectId(req.user._id as string));
    
    // Cache result for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(result));
    
    res.json({
      success: true,
      message: "Credit sales report generated successfully",
      data: result,
      cached: false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   SAVINGS REPORT
========================= */

// Generate savings report
router.post("/savings", auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      groupBy = "plan",
      format = "json",
      filters = {} 
    } = req.body;
    
    // Create cache key
    const cacheKey = `report:savings:${req.user._id}:${startDate}:${endDate}:${groupBy}:${JSON.stringify(filters)}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        message: "Savings report retrieved from cache",
        data: JSON.parse(cached.toString()),
        cached: true
      });
    }
    
    const report = new Report({
      name: "Savings Report",
      type: "savings",
      description: "Savings plans performance analysis",
      parameters: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        groupBy,
        format,
        filters
      },
      createdBy: req.user._id
    });
    
    const result = await (report as unknown as IReportDocument).generateReport(new mongoose.Types.ObjectId(req.user._id as string));
    
    // Cache result for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(result));
    
    res.json({
      success: true,
      message: "Savings report generated successfully",
      data: result,
      cached: false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   STAFF PERFORMANCE REPORT
========================= */

// Generate staff performance report
router.post("/staff-performance", auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      department,
      format = "json",
      includeDetails = false 
    } = req.body;
    
    // Create cache key
    const cacheKey = `report:staff-performance:${req.user._id}:${startDate}:${endDate}:${department}:${includeDetails}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        message: "Staff performance report retrieved from cache",
        data: JSON.parse(cached.toString()),
        cached: true
      });
    }
    
    const report = new Report({
      name: "Staff Performance Report",
      type: "staff_performance",
      description: "Staff performance and sales metrics",
      parameters: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        department,
        includeDetails,
        format
      },
      createdBy: req.user._id
    });
    
    const result = await (report as unknown as IReportDocument).generateReport(new mongoose.Types.ObjectId(req.user._id as string));
    
    // Cache result for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(result));
    
    res.json({
      success: true,
      message: "Staff performance report generated successfully",
      data: result,
      cached: false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   CUSTOM REPORT
========================= */

// Generate custom report
router.post("/custom", auth, async (req, res) => {
  try {
    const { 
      name,
      description,
      type,
      parameters,
      template,
      format = "json"
    } = req.body;
    
    // Create cache key
    const cacheKey = `report:custom:${req.user._id}:${type}:${JSON.stringify(parameters)}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        message: "Custom report retrieved from cache",
        data: JSON.parse(cached.toString()),
        cached: true
      });
    }
    
    const report = new Report({
      name: name || "Custom Report",
      description: description || "Custom generated report",
      type: type || "custom",
      parameters: {
        ...parameters,
        format
      },
      template: template || "standard",
      createdBy: req.user._id
    });
    
    const result = await (report as unknown as IReportDocument).generateReport(new mongoose.Types.ObjectId(req.user._id as string));
    
    // Cache result for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(result));
    
    res.json({
      success: true,
      message: "Custom report generated successfully",
      data: result,
      cached: false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   GET REPORT LIST
========================= */

// Get all reports
router.get("/", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type,
      status 
    } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;
    const filters: any = { createdBy: req.user._id };
    
    if (type) filters.type = type;
    if (status) filters.status = status;
    
    const reports = await Report.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    
    const totalCount = await Report.countDocuments(filters);
    
    res.json({
      success: true,
      data: {
        reports,
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

// Get single report
router.get("/:id", auth, async (req, res) => {
  try {
    const report = await Report.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    })
      .populate('generatedBy', 'name email')
      .populate('schedule.recipients', 'name email');
    
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    
    res.json({
      success: true,
      data: report
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Download report
router.get("/:id/download", auth, async (req, res) => {
  try {
    const report = await Report.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    
    if (!report.data.fileUrl) {
      return res.status(404).json({ message: "Report file not available" });
    }
    
    if (report.access.expiresAt && report.access.expiresAt < new Date()) {
      return res.status(403).json({ message: "Report download link has expired" });
    }
    
    res.json({
      success: true,
      downloadUrl: report.data.fileUrl,
      fileName: report.name.replace(/\s+/g, '_') + `_${Date.now()}.${report.parameters.format}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Schedule report
router.post("/:id/schedule", auth, async (req, res) => {
  try {
    const { frequency, recipients } = req.body;
    
    const report = await Report.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    
    await report.scheduleReport(frequency, recipients);
    
    res.json({
      success: true,
      message: "Report scheduled successfully",
      data: report
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
