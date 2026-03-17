import { Router } from "express";
import Expense from "../models/expense.js";
import ExpenseCategory from "../models/expenseCategory.js";
import auth from "../middlewares/auth.js";
import mongoose from "mongoose";

const router = Router();

/* =========================
   EXPENSE CATEGORIES
========================= */

// Get expense categories
router.get("/categories", auth, async (req, res) => {
  try {
    const categories = await ExpenseCategory.getCategoryTree(req.user._id);
    
    res.json({
      success: true,
      data: categories
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get root categories
router.get("/categories/root", auth, async (req, res) => {
  try {
    const categories = await ExpenseCategory.getRootCategories(req.user._id);
    
    res.json({
      success: true,
      data: categories
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Create expense category
router.post("/categories", auth, async (req, res) => {
  try {
    const categoryData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Generate category code if not provided
    if (!categoryData.code) {
      const count = await ExpenseCategory.countDocuments();
      categoryData.code = `EXP${String(count + 1).padStart(3, '0')}`;
    }
    
    const category = new ExpenseCategory(categoryData);
    await category.save();
    
    res.status(201).json({
      success: true,
      message: "Expense category created successfully",
      data: category
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Category code already exists" });
    }
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update expense category
router.put("/categories/:id", auth, async (req, res) => {
  try {
    const category = await ExpenseCategory.findOne({ 
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

// Delete expense category
router.delete("/categories/:id", auth, async (req, res) => {
  try {
    const category = await ExpenseCategory.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    // Check if category has expenses
    const expenseCount = await Expense.countDocuments({ 
      category: category._id,
      createdBy: req.user._id 
    });
    
    if (expenseCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete category with associated expenses" 
      });
    }
    
    // Check if category has subcategories
    const subcategoryCount = await ExpenseCategory.countDocuments({ 
      parentCategory: category._id,
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

// Search expense categories
router.get("/categories/search", auth, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }
    
    const categories = await ExpenseCategory.searchCategories(query, req.user._id);
    
    res.json({
      success: true,
      data: categories
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   EXPENSE MANAGEMENT
========================= */

// Get expenses
router.get("/", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      category,
      subcategory,
      status,
      startDate,
      endDate,
      paymentMethod,
      isRecurring,
      tags 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { createdBy: req.user._id };
    
    if (category) filters.category = category;
    if (subcategory) filters.subcategory = subcategory;
    if (status) filters.status = status;
    if (paymentMethod) filters.paymentMethod = paymentMethod;
    if (isRecurring) filters.isRecurring = isRecurring === "true";
    if (startDate) filters.expenseDate = { $gte: new Date(startDate) };
    if (endDate) filters.expenseDate = { $lte: new Date(endDate) };
    
    let query = Expense.find(filters);
    
    if (search) {
      query = Expense.searchExpenses(search, req.user._id, filters);
    }
    
    const expenses = await query
      .populate('category subcategory', 'name code')
      .sort({ expenseDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Expense.countDocuments(filters);
    
    res.json({
      success: true,
      data: {
        expenses,
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

// Get single expense
router.get("/:id", auth, async (req, res) => {
  try {
    const expense = await Expense.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    })
      .populate('category subcategory', 'name code')
      .populate('approvedBy reimbursedBy', 'name email');
    
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    
    res.json({
      success: true,
      data: expense
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Create expense
router.post("/", auth, async (req, res) => {
  try {
    const expenseData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    const expense = new Expense(expenseData);
    await expense.save();
    
    // Set next recurring date if applicable
    if (expense.isRecurring) {
      await expense.setNextRecurringDate();
    }
    
    await Expense.findById(expense._id)
      .populate('category subcategory', 'name code');
    
    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: expense
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update expense
router.put("/:id", auth, async (req, res) => {
  try {
    const expense = await Expense.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    
    Object.assign(expense, req.body, { updatedBy: req.user._id });
    await expense.save();
    
    // Update recurring date if applicable
    if (expense.isRecurring) {
      await expense.setNextRecurringDate();
    }
    
    await Expense.findById(expense._id)
      .populate('category subcategory', 'name code');
    
    res.json({
      success: true,
      message: "Expense updated successfully",
      data: expense
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Delete expense
router.delete("/:id", auth, async (req, res) => {
  try {
    const expense = await Expense.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    
    await Expense.findByIdAndDelete(expense._id);
    
    res.json({
      success: true,
      message: "Expense deleted successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   RECURRING EXPENSES
========================= */

// Get recurring expenses
router.get("/recurring", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20,
      status 
    } = req.query;
    
    const filters = { createdBy: req.user._id };
    if (status) filters.status = status;
    
    const expenses = await Expense.getRecurringExpenses(req.user._id)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const totalCount = await Expense.countDocuments({
      createdBy: req.user._id,
      isRecurring: true,
      ...filters
    });
    
    res.json({
      success: true,
      data: {
        expenses,
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

// Process recurring expenses
router.post("/recurring/process", auth, async (req, res) => {
  try {
    const { expenseIds } = req.body;
    
    if (!expenseIds || !Array.isArray(expenseIds)) {
      return res.status(400).json({ message: "Expense IDs array is required" });
    }
    
    const processedExpenses = [];
    
    for (const expenseId of expenseIds) {
      const expense = await Expense.findOne({
        _id: expenseId,
        createdBy: req.user._id,
        isRecurring: true,
        status: "approved"
      });
      
      if (expense) {
        // Create new expense instance for this occurrence
        const newExpense = new Expense({
          title: expense.title,
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          subcategory: expense.subcategory,
          expenseDate: new Date(),
          paymentMethod: expense.paymentMethod,
          reference: expense.reference,
          tags: expense.tags,
          status: "approved",
          isRecurring: true,
          recurringPattern: expense.recurringPattern,
          recurringEndDate: expense.recurringEndDate,
          vendor: expense.vendor,
          taxAmount: expense.taxAmount,
          currency: expense.currency,
          exchangeRate: expense.exchangeRate,
          notes: expense.notes,
          createdBy: req.user._id
        });
        
        await newExpense.save();
        await newExpense.setNextRecurringDate();
        
        processedExpenses.push(newExpense);
      }
    }
    
    res.json({
      success: true,
      message: "Recurring expenses processed successfully",
      data: processedExpenses
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   PENDING EXPENSES
========================= */

// Get pending expenses
router.get("/pending", auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const expenses = await Expense.getPendingExpenses(req.user._id)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const totalCount = await Expense.countDocuments({
      createdBy: req.user._id,
      status: "pending"
    });
    
    res.json({
      success: true,
      data: {
        expenses,
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

// Approve expense
router.post("/:id/approve", auth, async (req, res) => {
  try {
    const expense = await Expense.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    
    await expense.approve(req.user._id);
    
    res.json({
      success: true,
      message: "Expense approved successfully",
      data: expense
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Reject expense
router.post("/:id/reject", auth, async (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }
    
    const expense = await Expense.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    
    await expense.reject(req.user._id, reason);
    
    res.json({
      success: true,
      message: "Expense rejected successfully",
      data: expense
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Reimburse expense
router.post("/:id/reimburse", auth, async (req, res) => {
  try {
    const expense = await Expense.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    
    await expense.reimburse(req.user._id);
    
    res.json({
      success: true,
      message: "Expense reimbursed successfully",
      data: expense
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   EXPENSE RECORDS
========================= */

// Get expense records
router.get("/records", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      category,
      startDate,
      endDate,
      status,
      tags 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { createdBy: req.user._id };
    
    if (category) filters.category = category;
    if (status) filters.status = status;
    if (startDate) filters.expenseDate = { $gte: new Date(startDate) };
    if (endDate) filters.expenseDate = { $lte: new Date(endDate) };
    
    let query = Expense.find(filters);
    
    if (search) {
      query = Expense.searchExpenses(search, req.user._id, filters);
    }
    
    const expenses = await query
      .populate('category subcategory', 'name code')
      .populate('approvedBy reimbursedBy', 'name email')
      .sort({ expenseDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Expense.countDocuments(filters);
    
    res.json({
      success: true,
      data: {
        expenses,
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
   EXPENSE ANALYTICS
========================= */

// Get expense summary
router.get("/summary", auth, async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    
    const summary = await Expense.getExpenseSummary(req.user._id, startDate, endDate);
    
    // Filter by category if specified
    let filteredSummary = summary;
    if (category) {
      filteredSummary = await Expense.getExpensesByCategory(req.user._id, startDate, endDate);
    }
    
    res.json({
      success: true,
      data: filteredSummary[0] || summary[0] || {
        totalExpenses: 0,
        totalTax: 0,
        totalWithTax: 0,
        expenseCount: 0,
        averageExpense: 0,
        maxExpense: 0,
        minExpense: 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get expenses by category
router.get("/by-category", auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const categoryExpenses = await Expense.getExpensesByCategory(req.user._id, startDate, endDate);
    
    res.json({
      success: true,
      data: categoryExpenses
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get monthly expense trends
router.get("/trends", auth, async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const monthlyTrends = await Expense.aggregate([
      { $match: { 
        createdBy: mongoose.Types.ObjectId(req.user._id),
        status: "approved",
        expenseDate: { 
          $gte: new Date(year, 0, 1),
          $lt: new Date(year + 1, 0, 1)
        }
      }},
      {
        $group: {
          _id: { $month: "$expenseDate" },
          month: { $first: { $dateToString: { format: "%B", date: "$expenseDate" } } },
          totalAmount: { $sum: "$amount" },
          totalTax: { $sum: "$taxAmount" },
          expenseCount: { $sum: 1 },
          averageAmount: { $avg: "$amount" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    
    res.json({
      success: true,
      data: monthlyTrends
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
