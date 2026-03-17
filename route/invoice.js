import { Router } from "express";
import Invoice from "../models/invoice.js";
import Customer from "../models/customer.js";
import Supplier from "../models/supplier.js";
import Sale from "../models/sale.js";
import Purchase from "../models/purchase.js";
import auth from "../middlewares/auth.js";
import mongoose from "mongoose";

const router = Router();

/* =========================
   INVOICE MANAGEMENT
========================= */

// Get all invoices
router.get("/", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      type,
      status,
      customer,
      supplier,
      startDate,
      endDate 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { 
      createdBy: req.user._id 
    };
    
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (customer) filters.customer = customer;
    if (supplier) filters.supplier = supplier;
    if (startDate) filters.invoiceDate = { $gte: new Date(startDate) };
    if (endDate) filters.invoiceDate = { $lte: new Date(endDate) };
    
    let query = Invoice.find(filters);
    
    if (search) {
      query = Invoice.searchInvoices(search, req.user._id, filters);
    }
    
    const invoices = await query
      .populate('customer supplier', 'name phone email')
      .populate('items.product', 'name sku')
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Invoice.countDocuments(filters);
    
    res.json({
      success: true,
      data: {
        invoices,
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

// Get single invoice
router.get("/:id", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    })
      .populate('customer supplier', 'name phone email address')
      .populate('items.product', 'name sku')
      .populate('createdBy approvedBy', 'name email');
    
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    
    res.json({
      success: true,
      data: invoice
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Create invoice
router.post("/", auth, async (req, res) => {
  try {
    const invoiceData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    const invoice = new Invoice(invoiceData);
    await invoice.calculateTotals();
    await invoice.save();
    
    await Invoice.findById(invoice._id)
      .populate('customer supplier', 'name phone email')
      .populate('items.product', 'name sku');
    
    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: invoice
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update invoice
router.put("/:id", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    
    Object.assign(invoice, req.body);
    await invoice.calculateTotals();
    await invoice.save();
    
    res.json({
      success: true,
      message: "Invoice updated successfully",
      data: invoice
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Delete invoice
router.delete("/:id", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    
    invoice.status = "cancelled";
    await invoice.save();
    
    res.json({
      success: true,
      message: "Invoice cancelled successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   CREATE INVOICE
========================= */

// Create invoice from sale
router.post("/from-sale", auth, async (req, res) => {
  try {
    const { saleId } = req.body;
    
    const sale = await Sale.findOne({ 
      _id: saleId, 
      createdBy: req.user._id 
    })
      .populate('customer', 'name phone email address')
      .populate('items.product', 'name sku');
    
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }
    
    // Create invoice from sale
    const invoiceData = {
      type: "sale",
      customer: sale.customer?._id,
      items: sale.items.map(item => ({
        product: item.product._id,
        productName: item.productName,
        sku: item.sku,
        description: "",
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        discount: item.discount,
        discountType: item.discountType,
        taxRate: 7.5
      })),
      subtotal: sale.subtotal,
      discountAmount: sale.discountAmount,
      taxAmount: sale.taxAmount,
      totalAmount: sale.totalAmount,
      paidAmount: sale.paidAmount,
      balanceDue: sale.balanceDue,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      paymentTerms: "net_30",
      notes: sale.notes,
      createdBy: req.user._id
    };
    
    const invoice = new Invoice(invoiceData);
    await invoice.calculateTotals();
    await invoice.sendInvoice(req.user._id);
    
    await Invoice.findById(invoice._id)
      .populate('customer', 'name phone email address')
      .populate('items.product', 'name sku');
    
    res.status(201).json({
      success: true,
      message: "Invoice created from sale successfully",
      data: invoice
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Create invoice from purchase
router.post("/from-purchase", auth, async (req, res) => {
  try {
    const { purchaseId } = req.body;
    
    const purchase = await Purchase.findOne({ 
      _id: purchaseId, 
      createdBy: req.user._id 
    })
      .populate('supplier', 'name phone email')
      .populate('items.product', 'name sku');
    
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    
    // Create invoice from purchase
    const invoiceData = {
      type: "purchase",
      supplier: purchase.supplier._id,
      items: purchase.items.map(item => ({
        product: item.product._id,
        productName: item.productName,
        sku: item.sku,
        description: "",
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        discount: 0,
        discountType: "percentage",
        taxRate: 7.5
      })),
      subtotal: purchase.subtotal,
      discountAmount: purchase.discountAmount,
      taxAmount: purchase.taxAmount,
      totalAmount: purchase.totalAmount,
      paidAmount: 0,
      balanceDue: purchase.totalAmount,
      invoiceDate: new Date(),
      dueDate: purchase.paymentDueDate,
      paymentTerms: purchase.paymentTerms || "net_30",
      notes: purchase.notes,
      createdBy: req.user._id
    };
    
    const invoice = new Invoice(invoiceData);
    await invoice.calculateTotals();
    await invoice.sendInvoice(req.user._id);
    
    await Invoice.findById(invoice._id)
      .populate('supplier', 'name phone email')
      .populate('items.product', 'name sku');
    
    res.status(201).json({
      success: true,
      message: "Invoice created from purchase successfully",
      data: invoice
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   VIEW INVOICE
========================= */

// Get invoice PDF (placeholder for PDF generation)
router.get("/:id/pdf", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    })
      .populate('customer supplier', 'name phone email address')
      .populate('items.product', 'name sku');
    
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    
    // TODO: Implement PDF generation
    // For now, return invoice data for client-side PDF generation
    res.json({
      success: true,
      message: "Invoice data retrieved for PDF generation",
      data: invoice
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Print invoice (placeholder for printing)
router.post("/:id/print", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    })
      .populate('customer supplier', 'name phone email address')
      .populate('items.product', 'name sku');
    
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    
    // TODO: Implement printing functionality
    // For now, return success message
    res.json({
      success: true,
      message: "Invoice sent to printer successfully",
      data: invoice
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   INVOICE PAYMENTS
========================= */

// Add payment to invoice
router.post("/:id/payment", auth, async (req, res) => {
  try {
    const { amount, paymentMethod, reference } = req.body;
    
    const invoice = await Invoice.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    
    await invoice.addPayment(amount, paymentMethod, reference);
    
    res.json({
      success: true,
      message: "Payment added successfully",
      data: invoice
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get invoice payment history
router.get("/:id/payments", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    })
      .populate('customer supplier', 'name phone email')
      .populate('items.product', 'name sku');
    
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    
    // Return payment history (would be stored in separate collection in production)
    const paymentHistory = [];
    if (invoice.paidAmount > 0) {
      paymentHistory.push({
        amount: invoice.paidAmount,
        method: "mixed",
        date: invoice.updatedAt,
        reference: invoice.invoiceNumber
      });
    }
    
    res.json({
      success: true,
      data: {
        invoice,
        paymentHistory
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   OVERDUE INVOICES
========================= */

// Get overdue invoices
router.get("/overdue", auth, async (req, res) => {
  try {
    const overdueInvoices = await Invoice.getOverdueInvoices(req.user._id);
    
    res.json({
      success: true,
      data: overdueInvoices
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   INVOICE REPORTS
========================= */

// Get invoice summary
router.get("/summary", auth, async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    
    const summary = await Invoice.getInvoiceSummary(req.user._id, startDate, endDate);
    
    // Filter by type if specified
    let filteredSummary = summary;
    if (type) {
      filteredSummary = summary.filter(item => item._id === type);
    }
    
    res.json({
      success: true,
      data: filteredSummary
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get invoice aging report
router.get("/aging", auth, async (req, res) => {
  try {
    const today = new Date();
    
    const agingBuckets = await Invoice.aggregate([
      { $match: { 
        createdBy: mongoose.Types.ObjectId(req.user._id),
        status: { $in: ["sent", "overdue"] }
      }},
      {
        $addFields: {
          daysOverdue: {
            $subtract: [today, "$dueDate"]
          }
        }
      },
      {
        $addFields: {
          daysOverdue: {
            $divide: ["$daysOverdue", 1000 * 60 * 60 * 24]
          }
        }
      },
      {
        $bucket: {
          groupBy: "$type",
          boundaries: [0, 30, 60, 90],
          default: "90+",
          output: {
            totalAmount: { $sum: "$balanceDue" },
            count: { $sum: 1 }
          }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: agingBuckets
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
