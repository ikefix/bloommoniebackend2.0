import { Router } from "express";
import Sale from "../models/sale.js";
import Customer from "../models/customer.js";
import Invoice from "../models/invoice.js";
import auth from "../middlewares/auth.js";
import mongoose from "mongoose";

const router = Router();

/* =========================
   SALES HISTORY
========================= */

// Get sales history
router.get("/history", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      customer,
      status,
      startDate,
      endDate,
      saleType 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { 
      createdBy: req.user._id 
    };
    
    if (customer) filters.customer = customer;
    if (status) filters.status = status;
    if (saleType) filters.saleType = saleType;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    let query = Sale.searchSales(search, req.user._id, filters);
    
    const sales = await query
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Sale.countDocuments(filters);
    
    res.json({
      success: true,
      data: {
        sales,
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

// Get sales summary
router.get("/summary", auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const summary = await Sale.getSalesSummary(req.user._id, startDate, endDate);
    
    res.json({
      success: true,
      data: summary[0] || {
        totalSales: 0,
        totalItems: 0,
        totalTransactions: 0,
        averageSale: 0,
        cashSales: 0,
        creditSales: 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   CREDIT SALES
========================= */

// Get credit sales
router.get("/credit", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      customer,
      status 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { 
      createdBy: req.user._id,
      isCreditSale: true 
    };
    
    if (customer) filters.customer = customer;
    if (status) filters.status = status;
    
    const creditSales = await Sale.find(filters)
      .populate('customer', 'name phone email')
      .populate('items.product', 'name sku')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Sale.countDocuments(filters);
    
    // Calculate credit summary
    const creditSummary = await Sale.aggregate([
      { $match: { 
        createdBy: mongoose.Types.ObjectId(req.user._id),
        isCreditSale: true,
        status: "completed"
      }},
      {
        $group: {
          _id: null,
          totalCreditSales: { $sum: "$totalAmount" },
          totalCreditTransactions: { $sum: 1 },
          averageCreditSale: { $avg: "$totalAmount" },
          overdueAmount: {
            $sum: {
              $cond: [
                { $lt: [new Date(), "$creditDueDate"] },
                "$totalAmount",
                0
              ]
            }
          }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        sales: creditSales,
        summary: creditSummary[0] || {
          totalCreditSales: 0,
          totalCreditTransactions: 0,
          averageCreditSale: 0,
          overdueAmount: 0
        },
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

// Create credit sale
router.post("/credit", auth, async (req, res) => {
  try {
    const saleData = {
      ...req.body,
      isCreditSale: true,
      createdBy: req.user._id
    };
    
    const sale = new Sale(saleData);
    await sale.calculateTotals();
    await sale.processSale();
    
    await Sale.findById(sale._id)
      .populate('customer', 'name phone email')
      .populate('items.product', 'name sku')
      .populate('cashier', 'name email');
    
    res.status(201).json({
      success: true,
      message: "Credit sale created successfully",
      data: sale
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update credit sale payment
router.post("/credit/:id/payment", auth, async (req, res) => {
  try {
    const { amount, paymentMethod, reference } = req.body;
    
    const sale = await Sale.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id,
      isCreditSale: true 
    });
    
    if (!sale) {
      return res.status(404).json({ message: "Credit sale not found" });
    }
    
    if (sale.isFullyPaid) {
      return res.status(400).json({ message: "Sale is already fully paid" });
    }
    
    await sale.addPayment({
      method: paymentMethod,
      amount,
      reference,
      status: "completed",
      paidAt: new Date()
    });
    
    res.json({
      success: true,
      message: "Payment added to credit sale successfully",
      data: sale
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get overdue credit sales
router.get("/credit/overdue", auth, async (req, res) => {
  try {
    const today = new Date();
    
    const overdueSales = await Sale.find({
      createdBy: req.user._id,
      isCreditSale: true,
      status: "completed",
      creditDueDate: { $lt: today },
      balanceDue: { $gt: 0 }
    })
      .populate('customer', 'name phone email')
      .populate('items.product', 'name sku')
      .sort({ creditDueDate: 1 });
    
    res.json({
      success: true,
      data: overdueSales
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   RETURNS / REFUNDS
========================= */

// Process sale return
router.post("/:id/return", auth, async (req, res) => {
  try {
    const { returnItems, reason, refundAmount } = req.body;
    
    const sale = await Sale.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    })
      .populate('customer', 'name phone email')
      .populate('items.product', 'name sku');
    
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }
    
    const Product = mongoose.model("Product");
    const StockMovement = mongoose.model("StockMovement");
    
    // Process return items
    for (const returnItem of returnItems) {
      const product = await Product.findById(returnItem.productId);
      if (!product) {
        throw new Error(`Product not found: ${returnItem.productId}`);
      }
      
      // Create stock movement for return
      await StockMovement.createMovement({
        product: returnItem.productId,
        type: "in",
        quantity: returnItem.quantity,
        reference: `RET${sale.invoiceNumber}`,
        description: `Sale return: ${reason}`,
        reason: "return",
        createdBy: req.user._id,
        unitCost: returnItem.unitCost || 0,
        totalCost: (returnItem.unitCost || 0) * returnItem.quantity
      });
      
      // Update product stock (add returned items)
      await product.updateStock(returnItem.quantity, "add");
    }
    
    // Update sale status
    sale.status = "refunded";
    sale.notes = (sale.notes || "") + `\nReturned: ${reason}`;
    
    // Process refund
    if (refundAmount > 0) {
      await sale.addPayment({
        method: "refund",
        amount: refundAmount,
        reference: `REF${sale.invoiceNumber}`,
        status: "completed",
        paidAt: new Date()
      });
    }
    
    await sale.save();
    
    res.json({
      success: true,
      message: "Sale return processed successfully",
      data: { sale, returnItems, refundAmount }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get return history
router.get("/returns", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      startDate,
      endDate 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { 
      createdBy: req.user._id,
      status: "refunded" 
    };
    
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    const returns = await Sale.find(filters)
      .populate('customer', 'name phone email')
      .populate('items.product', 'name sku')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Sale.countDocuments(filters);
    
    // Calculate return summary
    const returnSummary = await Sale.aggregate([
      { $match: { 
        createdBy: mongoose.Types.ObjectId(req.user._id),
        status: "refunded"
      }},
      {
        $group: {
          _id: null,
          totalReturns: { $sum: 1 },
          totalRefundAmount: { $sum: "$paidAmount" },
          averageRefund: { $avg: "$paidAmount" }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        returns,
        summary: returnSummary[0] || {
          totalReturns: 0,
          totalRefundAmount: 0,
          averageRefund: 0
        },
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
   QUOTATIONS
========================= */

// Create quotation
router.post("/quotations", auth, async (req, res) => {
  try {
    const quotationData = {
      ...req.body,
      type: "quotation",
      status: "draft",
      createdBy: req.user._id
    };
    
    const quotation = new Invoice(quotationData);
    await quotation.calculateTotals();
    await quotation.save();
    
    await Invoice.findById(quotation._id)
      .populate('customer', 'name phone email')
      .populate('items.product', 'name sku');
    
    res.status(201).json({
      success: true,
      message: "Quotation created successfully",
      data: quotation
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get quotations
router.get("/quotations", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      customer,
      status 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { 
      createdBy: req.user._id,
      type: "quotation" 
    };
    
    if (customer) filters.customer = customer;
    if (status) filters.status = status;
    
    const quotations = await Invoice.find(filters)
      .populate('customer', 'name phone email')
      .populate('items.product', 'name sku')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Invoice.countDocuments(filters);
    
    res.json({
      success: true,
      data: {
        quotations,
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

// Convert quotation to invoice
router.post("/quotations/:id/convert", auth, async (req, res) => {
  try {
    const quotation = await Invoice.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id,
      type: "quotation" 
    });
    
    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }
    
    // Convert quotation to invoice
    quotation.type = "sale";
    quotation.status = "sent";
    quotation.invoiceDate = new Date();
    quotation.dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    await quotation.save();
    
    res.json({
      success: true,
      message: "Quotation converted to invoice successfully",
      data: quotation
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   DAILY REPORT
========================= */

// Get daily sales report
router.get("/reports/daily", auth, async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }
    
    const startOfDay = new Date(date);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const dailyReport = await Sale.aggregate([
      { $match: { 
        createdBy: mongoose.Types.ObjectId(req.user._id),
        status: "completed",
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }},
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            hour: { $hour: "$createdAt" }
          },
          totalSales: { $sum: "$totalAmount" },
          totalTransactions: { $sum: 1 },
          cashSales: {
            $sum: {
              $cond: [{ $eq: ["$saleType", "cash"] }, "$totalAmount", 0]
            }
          },
          creditSales: {
            $sum: {
              $cond: [{ $eq: ["$saleType", "credit"] }, "$totalAmount", 0]
            }
          },
          averageSale: { $avg: "$totalAmount" }
        }
      },
      { $sort: { "_id.date": 1, "_id.hour": 1 } }
    ]);
    
    // Calculate daily totals
    const dailyTotals = await Sale.aggregate([
      { $match: { 
        createdBy: mongoose.Types.ObjectId(req.user._id),
        status: "completed",
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }},
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$totalAmount" },
          totalTransactions: { $sum: 1 },
          cashSales: {
            $sum: {
              $cond: [{ $eq: ["$saleType", "cash"] }, "$totalAmount", 0]
            }
          },
          creditSales: {
            $sum: {
              $cond: [{ $eq: ["$saleType", "credit"] }, "$totalAmount", 0]
            }
          },
          averageSale: { $avg: "$totalAmount" }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        date,
        hourlyBreakdown: dailyReport,
        summary: dailyTotals[0] || {
          totalSales: 0,
          totalTransactions: 0,
          cashSales: 0,
          creditSales: 0,
          averageSale: 0
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   WEEKLY REPORT
========================= */

// Get weekly sales report
router.get("/reports/weekly", auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required" });
    }
    
    const weeklyReport = await Sale.aggregate([
      { $match: { 
        createdBy: mongoose.Types.ObjectId(req.user._id),
        status: "completed",
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
      }},
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalSales: { $sum: "$totalAmount" },
          totalTransactions: { $sum: 1 },
          cashSales: {
            $sum: {
              $cond: [{ $eq: ["$saleType", "cash"] }, "$totalAmount", 0]
            }
          },
          creditSales: {
            $sum: {
              $cond: [{ $eq: ["$saleType", "credit"] }, "$totalAmount", 0]
            }
          },
          averageSale: { $avg: "$totalAmount" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    
    // Calculate weekly totals
    const weeklyTotals = await Sale.aggregate([
      { $match: { 
        createdBy: mongoose.Types.ObjectId(req.user._id),
        status: "completed",
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
      }},
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$totalAmount" },
          totalTransactions: { $sum: 1 },
          cashSales: {
            $sum: {
              $cond: [{ $eq: ["$saleType", "cash"] }, "$totalAmount", 0]
            }
          },
          creditSales: {
            $sum: {
              $cond: [{ $eq: ["$saleType", "credit"] }, "$totalAmount", 0]
            }
          },
          averageSale: { $avg: "$totalAmount" }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        dailyBreakdown: weeklyReport,
        summary: weeklyTotals[0] || {
          totalSales: 0,
          totalTransactions: 0,
          cashSales: 0,
          creditSales: 0,
          averageSale: 0
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   MONTHLY REPORT
========================= */

// Get monthly sales report
router.get("/reports/monthly", auth, async (req, res) => {
  try {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ message: "Year and month are required" });
    }
    
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);
    
    const monthlyReport = await Sale.aggregate([
      { $match: { 
        createdBy: mongoose.Types.ObjectId(req.user._id),
        status: "completed",
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
      }},
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalSales: { $sum: "$totalAmount" },
          totalTransactions: { $sum: 1 },
          cashSales: {
            $sum: {
              $cond: [{ $eq: ["$saleType", "cash"] }, "$totalAmount", 0]
            }
          },
          creditSales: {
            $sum: {
              $cond: [{ $eq: ["$saleType", "credit"] }, "$totalAmount", 0]
            }
          },
          averageSale: { $avg: "$totalAmount" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    
    // Calculate monthly totals
    const monthlyTotals = await Sale.aggregate([
      { $match: { 
        createdBy: mongoose.Types.ObjectId(req.user._id),
        status: "completed",
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
      }},
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$totalAmount" },
          totalTransactions: { $sum: 1 },
          cashSales: {
            $sum: {
              $cond: [{ $eq: ["$saleType", "cash"] }, "$totalAmount", 0]
            }
          },
          creditSales: {
            $sum: {
              $cond: [{ $eq: ["$saleType", "credit"] }, "$totalAmount", 0]
            }
          },
          averageSale: { $avg: "$totalAmount" }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        period: { year, month },
        dailyBreakdown: monthlyReport,
        summary: monthlyTotals[0] || {
          totalSales: 0,
          totalTransactions: 0,
          cashSales: 0,
          creditSales: 0,
          averageSale: 0
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
