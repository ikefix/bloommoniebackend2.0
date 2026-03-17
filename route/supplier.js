import { Router } from "express";
import Supplier from "../models/supplier.js";
import PurchaseOrder from "../models/purchaseOrder.js";
import Purchase from "../models/purchase.js";
import Invoice from "../models/invoice.js";
import auth from "../middlewares/auth.js";
import mongoose from "mongoose";

const router = Router();

/* =========================
   SUPPLIER MANAGEMENT
========================= */

// Get all suppliers
router.get("/", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search,
      businessType,
      rating 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { 
      createdBy: req.user._id,
      isActive: true 
    };
    
    if (businessType) filters.businessType = businessType;
    if (rating) filters.rating = parseInt(rating);
    
    let query = Supplier.find(filters);
    
    if (search) {
      query = Supplier.searchSuppliers(search, req.user._id);
    } else {
      query = query.populate('products.product', 'name sku');
    }
    
    const suppliers = await query
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Supplier.countDocuments(filters);
    
    res.json({
      success: true,
      data: {
        suppliers,
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

// Get single supplier
router.get("/:id", auth, async (req, res) => {
  try {
    const supplier = await Supplier.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    })
      .populate('products.product', 'name sku');
    
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    
    res.json({
      success: true,
      data: supplier
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Create supplier
router.post("/", auth, async (req, res) => {
  try {
    const supplierData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Generate supplier code if not provided
    if (!supplierData.code) {
      const count = await Supplier.countDocuments();
      supplierData.code = `SUP${String(count + 1).padStart(4, '0')}`;
    }
    
    const supplier = new Supplier(supplierData);
    await supplier.save();
    
    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: supplier
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Supplier code already exists" });
    }
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update supplier
router.put("/:id", auth, async (req, res) => {
  try {
    const supplier = await Supplier.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    
    Object.assign(supplier, req.body);
    await supplier.save();
    
    res.json({
      success: true,
      message: "Supplier updated successfully",
      data: supplier
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Delete supplier
router.delete("/:id", auth, async (req, res) => {
  try {
    const supplier = await Supplier.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    
    supplier.isActive = false;
    await supplier.save();
    
    res.json({
      success: true,
      message: "Supplier deleted successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   SUPPLIER PRODUCTS
========================= */

// Add product to supplier
router.post("/:id/products", auth, async (req, res) => {
  try {
    const supplier = await Supplier.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    
    const productData = {
      ...req.body,
      isActive: true
    };
    
    await supplier.addProduct(productData);
    
    res.json({
      success: true,
      message: "Product added to supplier successfully",
      data: supplier
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update supplier product
router.put("/:id/products/:productId", auth, async (req, res) => {
  try {
    const supplier = await Supplier.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    
    const product = supplier.products.id(req.params.productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    Object.assign(product, req.body);
    await supplier.save();
    
    res.json({
      success: true,
      message: "Supplier product updated successfully",
      data: product
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   PURCHASE ORDERS
========================= */

// Get purchase orders
router.get("/:id/purchase-orders", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status,
      startDate,
      endDate 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { 
      supplier: req.params.id,
      createdBy: req.user._id 
    };
    
    if (status) filters.status = status;
    if (startDate) filters.orderDate = { $gte: new Date(startDate) };
    if (endDate) filters.orderDate = { $lte: new Date(endDate) };
    
    const orders = await PurchaseOrder.find(filters)
      .populate('items.product', 'name sku')
      .populate('approvedBy receivedBy', 'name email')
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await PurchaseOrder.countDocuments(filters);
    
    res.json({
      success: true,
      data: {
        orders,
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

// Create purchase order
router.post("/:id/purchase-orders", auth, async (req, res) => {
  try {
    const orderData = {
      ...req.body,
      supplier: req.params.id,
      createdBy: req.user._id
    };
    
    const order = new PurchaseOrder(orderData);
    await order.calculateTotals();
    await order.save();
    
    await PurchaseOrder.findById(order._id)
      .populate('supplier', 'name phone email')
      .populate('items.product', 'name sku');
    
    res.status(201).json({
      success: true,
      message: "Purchase order created successfully",
      data: order
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Send purchase order
router.post("/purchase-orders/:id/send", auth, async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne({ 
      _id: req.params.id,
      createdBy: req.user._id 
    });
    
    if (!order) {
      return res.status(404).json({ message: "Purchase order not found" });
    }
    
    await order.sendOrder(req.user._id);
    
    res.json({
      success: true,
      message: "Purchase order sent successfully",
      data: order
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Receive purchase order
router.post("/purchase-orders/:id/receive", auth, async (req, res) => {
  try {
    const { receivedItems } = req.body;
    
    const order = await PurchaseOrder.findOne({ 
      _id: req.params.id,
      createdBy: req.user._id 
    });
    
    if (!order) {
      return res.status(404).json({ message: "Purchase order not found" });
    }
    
    await order.receiveItems(receivedItems, req.user._id);
    
    res.json({
      success: true,
      message: "Purchase order received successfully",
      data: order
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   SUPPLIER INVOICES
========================= */

// Get supplier invoices
router.get("/:id/invoices", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status,
      startDate,
      endDate 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { 
      supplier: req.params.id,
      type: "purchase",
      createdBy: req.user._id 
    };
    
    if (status) filters.status = status;
    if (startDate) filters.invoiceDate = { $gte: new Date(startDate) };
    if (endDate) filters.invoiceDate = { $lte: new Date(endDate) };
    
    const invoices = await Invoice.find(filters)
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

/* =========================
   SUPPLIER PAYMENTS
========================= */

// Get supplier payment history
router.get("/:id/payments", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      startDate,
      endDate 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { 
      supplier: req.params.id,
      type: "purchase",
      createdBy: req.user._id 
    };
    
    if (startDate) filters.invoiceDate = { $gte: new Date(startDate) };
    if (endDate) filters.invoiceDate = { $lte: new Date(endDate) };
    
    const invoices = await Invoice.find(filters)
      .select('invoiceNumber totalAmount paidAmount balanceDue invoiceDate status')
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Invoice.countDocuments(filters);
    
    // Calculate payment summary
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const totalBalance = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0);
    
    res.json({
      success: true,
      data: {
        invoices,
        summary: {
          totalInvoiced,
          totalPaid,
          totalBalance,
          invoiceCount: invoices.length
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

// Record supplier payment
router.post("/:id/payments", auth, async (req, res) => {
  try {
    const { invoiceId, amount, paymentMethod, reference } = req.body;
    
    const invoice = await Invoice.findOne({ 
      _id: invoiceId,
      supplier: req.params.id,
      createdBy: req.user._id 
    });
    
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    
    await invoice.addPayment(amount, paymentMethod, reference);
    
    res.json({
      success: true,
      message: "Payment recorded successfully",
      data: invoice
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   SUPPLIER TRANSACTIONS
========================= */

// Get supplier transaction history
router.get("/:id/transactions", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      startDate,
      endDate,
      type 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { 
      supplier: req.params.id,
      createdBy: req.user._id 
    };
    
    if (startDate) filters.invoiceDate = { $gte: new Date(startDate) };
    if (endDate) filters.invoiceDate = { $lte: new Date(endDate) };
    if (type) filters.type = type;
    
    const invoices = await Invoice.find(filters)
      .populate('items.product', 'name sku')
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Invoice.countDocuments(filters);
    
    // Calculate transaction summary by type
    const summary = await Invoice.getInvoiceSummary(req.user._id, startDate, endDate);
    
    res.json({
      success: true,
      data: {
        transactions: invoices,
        summary,
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
   SUPPLIER DASHBOARD
========================= */

// Get supplier dashboard
router.get("/:id/dashboard", auth, async (req, res) => {
  try {
    const supplierId = req.params.id;
    
    const [
      supplier,
      totalOrders,
      pendingOrders,
      totalInvoices,
      overdueInvoices,
      recentTransactions
    ] = await Promise.all([
      Supplier.findOne({ _id: supplierId, createdBy: req.user._id })
        .populate('products.product', 'name sku'),
      PurchaseOrder.countDocuments({ 
        supplier: supplierId, 
        createdBy: req.user._id 
      }),
      PurchaseOrder.countDocuments({ 
        supplier: supplierId, 
        status: { $in: ["draft", "sent", "confirmed"] },
        createdBy: req.user._id 
      }),
      Invoice.countDocuments({ 
        supplier: supplierId, 
        type: "purchase",
        createdBy: req.user._id 
      }),
      Invoice.countDocuments({ 
        supplier: supplierId, 
        type: "purchase",
        status: "overdue",
        createdBy: req.user._id 
      }),
      Invoice.find({ 
        supplier: supplierId, 
        createdBy: req.user._id 
      })
        .populate('items.product', 'name sku')
        .sort({ invoiceDate: -1 })
        .limit(10)
    ]);
    
    // Calculate financial summary
    const financialSummary = await Invoice.aggregate([
      { $match: { supplier: mongoose.Types.ObjectId(supplierId), createdBy: mongoose.Types.ObjectId(req.user._id) } },
      {
        $group: {
          _id: null,
          totalInvoiced: { $sum: "$totalAmount" },
          totalPaid: { $sum: "$paidAmount" },
          balanceDue: { $sum: "$balanceDue" }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        supplier,
        summary: {
          totalOrders,
          pendingOrders,
          totalInvoices,
          overdueInvoices,
          financial: financialSummary[0] || { totalInvoiced: 0, totalPaid: 0, balanceDue: 0 }
        },
        recentTransactions
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
