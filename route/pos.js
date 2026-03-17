import { Router } from "express";
import Product from "../models/product.js";
import Customer from "../models/customer.js";
import Sale from "../models/sale.js";
import Discount from "../models/discount.js";
import StockMovement from "../models/stockMovement.js";
import auth from "../middlewares/auth.js";
import mongoose from "mongoose";

const router = Router();

// Temporary cart storage (in production, use Redis or database)
const activeCarts = new Map();

/* =========================
   CART MANAGEMENT
========================= */

// Initialize cart for user
const initializeCart = (userId) => {
  if (!activeCarts.has(userId)) {
    activeCarts.set(userId, {
      items: [],
      customer: null,
      discount: null,
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 0,
      createdAt: new Date()
    });
  }
  return activeCarts.get(userId);
};

// Get current cart
router.get("/cart", auth, async (req, res) => {
  try {
    const cart = initializeCart(req.user._id);
    
    // Populate product details
    const populatedItems = await Promise.all(
      cart.items.map(async (item) => {
        const product = await Product.findById(item.productId)
          .populate('category brand unit');
        return {
          ...item,
          product
        };
      })
    );
    
    cart.items = populatedItems;
    calculateCartTotals(cart);
    
    res.json({
      success: true,
      data: cart
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Add product to cart
router.post("/cart/add", auth, async (req, res) => {
  try {
    const { productId, quantity = 1, barcode, sku } = req.body;
    
    let product;
    
    // Find product by ID, barcode, or SKU
    if (productId) {
      product = await Product.findOne({ 
        _id: productId, 
        createdBy: req.user._id,
        isActive: true 
      }).populate('category brand unit');
    } else if (barcode) {
      product = await Product.findOne({ 
        barcode, 
        createdBy: req.user._id,
        isActive: true 
      }).populate('category brand unit');
    } else if (sku) {
      product = await Product.findOne({ 
        sku, 
        createdBy: req.user._id,
        isActive: true 
      }).populate('category brand unit');
    }
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    if (product.stock.currentStock < quantity) {
      return res.status(400).json({ 
        message: `Insufficient stock. Only ${product.stock.currentStock} available` 
      });
    }
    
    const cart = initializeCart(req.user._id);
    
    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.productId.toString() === product._id.toString()
    );
    
    if (existingItemIndex >= 0) {
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      if (product.stock.currentStock < newQuantity) {
        return res.status(400).json({ 
          message: `Insufficient stock. Only ${product.stock.currentStock} available` 
        });
      }
      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].totalPrice = newQuantity * product.sellingPrice;
    } else {
      cart.items.push({
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        barcode: product.barcode,
        quantity,
        unitPrice: product.sellingPrice,
        totalPrice: quantity * product.sellingPrice,
        discount: 0,
        discountType: "percentage",
        finalPrice: quantity * product.sellingPrice,
        product
      });
    }
    
    calculateCartTotals(cart);
    
    res.json({
      success: true,
      message: "Product added to cart",
      data: cart
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update cart item quantity
router.put("/cart/update", auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    if (quantity <= 0) {
      return res.status(400).json({ message: "Quantity must be greater than 0" });
    }
    
    const cart = initializeCart(req.user._id);
    const itemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    );
    
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found in cart" });
    }
    
    const product = await Product.findById(productId);
    if (product.stock.currentStock < quantity) {
      return res.status(400).json({ 
        message: `Insufficient stock. Only ${product.stock.currentStock} available` 
      });
    }
    
    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].totalPrice = quantity * cart.items[itemIndex].unitPrice;
    cart.items[itemIndex].finalPrice = cart.items[itemIndex].totalPrice;
    
    calculateCartTotals(cart);
    
    res.json({
      success: true,
      message: "Cart updated",
      data: cart
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Remove item from cart
router.delete("/cart/:productId", auth, async (req, res) => {
  try {
    const cart = initializeCart(req.user._id);
    cart.items = cart.items.filter(
      item => item.productId.toString() !== req.params.productId
    );
    
    calculateCartTotals(cart);
    
    res.json({
      success: true,
      message: "Item removed from cart",
      data: cart
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Clear cart
router.delete("/cart", auth, async (req, res) => {
  try {
    activeCarts.delete(req.user._id);
    
    res.json({
      success: true,
      message: "Cart cleared"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   CUSTOMER MANAGEMENT
========================= */

// Search customers
router.get("/customers/search", auth, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }
    
    const customers = await Customer.searchCustomers(query, req.user._id);
    
    res.json({
      success: true,
      data: customers
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Add customer to cart
router.post("/cart/customer", auth, async (req, res) => {
  try {
    const { customerId } = req.body;
    
    let customer;
    if (customerId) {
      customer = await Customer.findOne({ 
        _id: customerId, 
        createdBy: req.user._id 
      });
    }
    
    const cart = initializeCart(req.user._id);
    cart.customer = customer;
    
    // Apply customer discount if any
    if (customer && customer.discountRate > 0) {
      applyCustomerDiscount(cart, customer);
    }
    
    res.json({
      success: true,
      message: "Customer added to cart",
      data: cart
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Create new customer
router.post("/customers", auth, async (req, res) => {
  try {
    const customerData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    const customer = new Customer(customerData);
    await customer.save();
    
    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: customer
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   DISCOUNT MANAGEMENT
========================= */

// Get available discounts
router.get("/discounts", auth, async (req, res) => {
  try {
    const discounts = await Discount.findValidDiscounts(req.user._id);
    
    res.json({
      success: true,
      data: discounts
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Apply discount to cart
router.post("/cart/discount", auth, async (req, res) => {
  try {
    const { discountCode } = req.body;
    
    if (!discountCode) {
      return res.status(400).json({ message: "Discount code is required" });
    }
    
    const discount = await Discount.getByCode(discountCode, req.user._id);
    
    if (!discount) {
      return res.status(404).json({ message: "Invalid discount code" });
    }
    
    const cart = initializeCart(req.user._id);
    const canApply = discount.canBeApplied(cart.subtotal);
    
    if (!canApply.valid) {
      return res.status(400).json({ message: canApply.reason });
    }
    
    cart.discount = discount;
    calculateCartTotals(cart);
    
    res.json({
      success: true,
      message: "Discount applied successfully",
      data: cart
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Remove discount from cart
router.delete("/cart/discount", auth, async (req, res) => {
  try {
    const cart = initializeCart(req.user._id);
    cart.discount = null;
    calculateCartTotals(cart);
    
    res.json({
      success: true,
      message: "Discount removed",
      data: cart
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   CHECKOUT PROCESS
========================= */

// Calculate cart totals
const calculateCartTotals = (cart) => {
  cart.subtotal = cart.items.reduce((sum, item) => sum + item.finalPrice, 0);
  
  // Apply discount
  if (cart.discount) {
    cart.discountAmount = cart.discount.calculateDiscount(cart.subtotal, cart.items);
  } else {
    cart.discountAmount = 0;
  }
  
  // Calculate tax (7.5% VAT)
  const taxableAmount = cart.subtotal - cart.discountAmount;
  cart.taxAmount = taxableAmount * 0.075;
  
  cart.totalAmount = taxableAmount + cart.taxAmount;
};

// Apply customer discount
const applyCustomerDiscount = (cart, customer) => {
  cart.items.forEach(item => {
    const discount = item.totalPrice * (customer.discountRate / 100);
    item.discount = customer.discountRate;
    item.discountType = "percentage";
    item.finalPrice = item.totalPrice - discount;
  });
};

// Create sale
router.post("/checkout", auth, async (req, res) => {
  try {
    const { 
      paymentMethod, 
      paidAmount, 
      isCreditSale = false, 
      creditDueDate = null,
      notes = "" 
    } = req.body;
    
    const cart = initializeCart(req.user._id);
    
    if (cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }
    
    // Validate payment
    if (!isCreditSale && !paidAmount) {
      return res.status(400).json({ message: "Payment amount is required" });
    }
    
    if (!isCreditSale && paidAmount < cart.totalAmount) {
      return res.status(400).json({ 
        message: "Insufficient payment amount" 
      });
    }
    
    // Create sale
    const saleData = {
      customer: cart.customer?._id || null,
      items: cart.items.map(item => ({
        product: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unit: item.product.unit.name,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        discount: item.discount,
        discountType: item.discountType,
        finalPrice: item.finalPrice
      })),
      subtotal: cart.subtotal,
      discountAmount: cart.discountAmount,
      taxAmount: cart.taxAmount,
      totalAmount: cart.totalAmount,
      paidAmount: isCreditSale ? 0 : paidAmount,
      changeAmount: isCreditSale ? 0 : paidAmount - cart.totalAmount,
      saleType: isCreditSale ? "credit" : "cash",
      isCreditSale,
      creditDueDate,
      notes,
      cashier: req.user._id,
      createdBy: req.user._id
    };
    
    // Add payment if not credit sale
    if (!isCreditSale) {
      saleData.payments = [{
        method: paymentMethod,
        amount: paidAmount,
        status: "completed",
        paidAt: new Date()
      }];
    }
    
    const sale = new Sale(saleData);
    await sale.processSale();
    
    // Increment discount usage if applicable
    if (cart.discount) {
      await cart.discount.incrementUsage();
    }
    
    // Clear cart
    activeCarts.delete(req.user._id);
    
    // Get populated sale
    const populatedSale = await Sale.findById(sale._id)
      .populate('customer', 'name phone email')
      .populate('items.product', 'name sku')
      .populate('cashier', 'name email');
    
    res.status(201).json({
      success: true,
      message: "Sale completed successfully",
      data: populatedSale
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get receipt
router.get("/receipt/:saleId", auth, async (req, res) => {
  try {
    const sale = await Sale.findOne({ 
      _id: req.params.saleId,
      createdBy: req.user._id 
    })
      .populate('customer', 'name phone email address')
      .populate('items.product', 'name sku')
      .populate('cashier', 'name email');
    
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }
    
    res.json({
      success: true,
      data: sale
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Email receipt
router.post("/receipt/:saleId/email", auth, async (req, res) => {
  try {
    const { email } = req.body;
    
    const sale = await Sale.findOne({ 
      _id: req.params.saleId,
      createdBy: req.user._id 
    })
      .populate('customer', 'name phone email address')
      .populate('items.product', 'name sku')
      .populate('cashier', 'name email');
    
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }
    
    // TODO: Implement email sending functionality
    // await sendReceiptEmail(email, sale);
    
    res.json({
      success: true,
      message: "Receipt sent successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   SALES REPORTS
========================= */

// Get sales summary
router.get("/sales/summary", auth, async (req, res) => {
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

// Get sales history
router.get("/sales", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      startDate, 
      endDate 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = {};
    
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    let query = Sale.searchSales(search, req.user._id, filters);
    
    const sales = await query
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Sale.countDocuments({ 
      createdBy: req.user._id,
      ...filters 
    });
    
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

export default router;
