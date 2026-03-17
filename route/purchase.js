import { Router } from "express";
import Purchase from "../models/purchase.js";
import PurchaseOrder from "../models/purchaseOrder.js";
import Supplier from "../models/supplier.js";
import Product from "../models/product.js";
import StockMovement from "../models/stockMovement.js";
import auth from "../middlewares/auth.js";
import mongoose from "mongoose";

const router = Router();

/* =========================
   NEW PURCHASE
========================= */

// Create new purchase
router.post("/", auth, async (req, res) => {
  try {
    const purchaseData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    const purchase = new Purchase(purchaseData);
    await purchase.calculateTotals();
    await purchase.save();
    
    // Update stock if purchase is received
    if (purchase.status === "received") {
      await purchase.receivePurchase(req.user._id);
    }
    
    await Purchase.findById(purchase._id)
      .populate('supplier', 'name phone email')
      .populate('purchaseOrder', 'orderNumber')
      .populate('items.product', 'name sku');
    
    res.status(201).json({
      success: true,
      message: "Purchase created successfully",
      data: purchase
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get purchases
router.get("/", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      supplier,
      status,
      startDate,
      endDate 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { 
      createdBy: req.user._id 
    };
    
    if (supplier) filters.supplier = supplier;
    if (status) filters.status = status;
    if (startDate) filters.purchaseDate = { $gte: new Date(startDate) };
    if (endDate) filters.purchaseDate = { $lte: new Date(endDate) };
    
    let query = Purchase.find(filters);
    
    if (search) {
      query = Purchase.searchPurchases(search, req.user._id, filters);
    }
    
    const purchases = await query
      .populate('supplier', 'name phone email')
      .populate('items.product', 'name sku')
      .sort({ purchaseDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Purchase.countDocuments(filters);
    
    res.json({
      success: true,
      data: {
        purchases,
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

// Get single purchase
router.get("/:id", auth, async (req, res) => {
  try {
    const purchase = await Purchase.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    })
      .populate('supplier', 'name phone email')
      .populate('purchaseOrder', 'orderNumber')
      .populate('items.product', 'name sku');
    
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    
    res.json({
      success: true,
      data: purchase
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update purchase
router.put("/:id", auth, async (req, res) => {
  try {
    const purchase = await Purchase.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    
    Object.assign(purchase, req.body);
    await purchase.calculateTotals();
    await purchase.save();
    
    res.json({
      success: true,
      message: "Purchase updated successfully",
      data: purchase
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
router.get("/orders", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status,
      supplier,
      startDate,
      endDate 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { 
      createdBy: req.user._id 
    };
    
    if (supplier) filters.supplier = supplier;
    if (status) filters.status = status;
    if (startDate) filters.orderDate = { $gte: new Date(startDate) };
    if (endDate) filters.orderDate = { $lte: new Date(endDate) };
    
    const orders = await PurchaseOrder.getPendingOrders(req.user._id, filters)
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
router.post("/orders", auth, async (req, res) => {
  try {
    const orderData = {
      ...req.body,
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

// Convert purchase order to purchase
router.post("/orders/:id/convert", auth, async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    })
      .populate('supplier', 'name phone email')
      .populate('items.product', 'name sku');
    
    if (!order) {
      return res.status(404).json({ message: "Purchase order not found" });
    }
    
    if (order.status !== "confirmed") {
      return res.status(400).json({ 
        message: "Purchase order must be confirmed before converting" 
      });
    }
    
    // Create purchase from order
    const purchaseData = {
      supplier: order.supplier._id,
      purchaseOrder: order._id,
      items: order.items.map(item => ({
        product: item.product._id,
        productName: item.productName,
        sku: item.sku,
        quantity: item.receivedQuantity || item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      })),
      subtotal: order.subtotal,
      totalAmount: order.totalAmount,
      purchaseDate: new Date(),
      paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      status: "received",
      createdBy: req.user._id
    };
    
    const purchase = new Purchase(purchaseData);
    await purchase.receivePurchase(req.user._id);
    
    // Update order status
    order.status = "received";
    await order.save();
    
    res.status(201).json({
      success: true,
      message: "Purchase order converted successfully",
      data: purchase
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   PURCHASE RETURNS
========================= */

// Create purchase return
router.post("/:id/return", auth, async (req, res) => {
  try {
    const { returnItems, reason } = req.body;
    
    const purchase = await Purchase.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
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
        type: "out",
        quantity: returnItem.quantity,
        reference: `RET${purchase.purchaseNumber}`,
        description: `Purchase return: ${reason}`,
        reason: "return",
        createdBy: req.user._id,
        unitCost: returnItem.unitPrice || 0,
        totalCost: (returnItem.unitPrice || 0) * returnItem.quantity
      });
      
      // Update product stock (subtract returned items)
      await product.updateStock(returnItem.quantity, "subtract");
    }
    
    // Update purchase status
    purchase.status = "returned";
    purchase.notes = (purchase.notes || "") + `\nReturned: ${reason}`;
    await purchase.save();
    
    res.json({
      success: true,
      message: "Purchase return processed successfully",
      data: { purchase, returnItems }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   PURCHASE HISTORY
========================= */

// Get purchase history
router.get("/history", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      supplier,
      status,
      startDate,
      endDate 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { 
      createdBy: req.user._id 
    };
    
    if (supplier) filters.supplier = supplier;
    if (status) filters.status = status;
    if (startDate) filters.purchaseDate = { $gte: new Date(startDate) };
    if (endDate) filters.purchaseDate = { $lte: new Date(endDate) };
    
    const purchases = await Purchase.find(filters)
      .populate('supplier', 'name phone email')
      .populate('items.product', 'name sku')
      .sort({ purchaseDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Purchase.countDocuments(filters);
    
    res.json({
      success: true,
      data: {
        purchases,
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

// Get purchase summary
router.get("/summary", auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const summary = await Purchase.getPurchaseSummary(req.user._id, startDate, endDate);
    
    res.json({
      success: true,
      data: summary[0] || {
        totalPurchases: 0,
        totalItems: 0,
        totalTransactions: 0,
        averagePurchase: 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get overdue purchases
router.get("/overdue", auth, async (req, res) => {
  try {
    const overduePurchases = await Purchase.getOverduePurchases(req.user._id);
    
    res.json({
      success: true,
      data: overduePurchases
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
