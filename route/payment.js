import { Router } from "express";
import User from "../models/user.js";
import Wallet from "../models/wallet.js";
import LedgerEntry from "../models/ledger.js";
import FraudDetection from "../models/fraudDetection.js";
import PaystackService from "../service/paystackService.js";
import auth from "../middlewares/auth.js";
import crypto from "crypto";
import mongoose from "mongoose";

const router = Router();

// Helper function to generate unique reference
const generateReference = (prefix) => {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

/* =========================
   INITIALIZE PAYMENT FOR WALLET FUNDING
========================= */
router.post("/initialize", auth, async (req, res) => {
  try {
    const { amount, description, paymentMethod = "card" } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }
    
    if (!description) {
      return res.status(400).json({ message: "Description is required" });
    }

    // Get user details
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user wallet
    const wallet = await Wallet.getUserWallet(req.user._id);
    
    // Check transaction limits
    await wallet.checkTransactionLimit(amount, "deposit");
    
    // Perform fraud detection
    const fraudCheck = await FraudDetection.analyzeTransaction({
      userId: req.user._id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      transactionType: "deposit",
      reference: generateReference("PAYMENT_INIT"),
      amount
    });

    if (fraudCheck.action === "block") {
      return res.status(403).json({ 
        message: "Payment blocked due to security concerns",
        riskScore: fraudCheck.riskScore
      });
    }

    // Initialize Paystack transaction
    const metadata = {
      userId: user._id.toString(),
      userEmail: user.email,
      userName: user.name,
      userPhone: user.phone,
      description,
      amount,
      purpose: 'wallet_funding',
      paymentMethod,
      fraudCheckId: fraudCheck._id
    };

    const result = await PaystackService.initializeTransaction(
      user.email,
      amount,
      metadata
    );

    if (result.success) {
      // Create pending ledger entry for tracking
      const reference = generateReference("PAYMENT_PENDING");
      await LedgerEntry.createDoubleEntry([
        {
          accountType: "wallet",
          accountId: wallet._id,
          userId: req.user._id,
          debit: 0,
          credit: amount,
          balance: wallet.balance + amount,
          reference,
          transactionType: "deposit",
          description: `Pending payment: ${result.data.reference} - ${description}`,
          status: "pending",
          metadata: {
            paymentMethod,
            gatewayReference: result.data.reference,
            fraudCheckId: fraudCheck._id
          },
          gatewayReference: result.data.reference,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        },
        {
          accountType: "settlement",
          accountId: new mongoose.Types.ObjectId(),
          userId: req.user._id,
          debit: amount,
          credit: 0,
          balance: 0,
          reference,
          transactionType: "settlement",
          description: `Pending settlement: ${result.data.reference}`,
          status: "pending",
          metadata: {
            paymentMethod,
            gatewayReference: result.data.reference
          }
        }
      ]);

      res.json({
        success: true,
        message: "Payment initialized successfully",
        data: {
          authorization_url: result.data.authorization_url,
          access_code: result.data.access_code,
          reference: result.data.reference,
          amount: amount,
          description: description,
          paymentMethod
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || "Failed to initialize payment"
      });
    }
  } catch (err) {
    console.error("Payment initialization error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   VERIFY PAYMENT AND FUND WALLET
========================= */
router.post("/verify/:reference", auth, async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ message: "Reference is required" });
    }

    // Verify transaction with Paystack
    const result = await PaystackService.verifyTransaction(reference);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || "Failed to verify payment"
      });
    }

    const transactionData = result.data;

    // Check if transaction was successful
    if (transactionData.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: `Payment ${transactionData.status}: ${transactionData.gateway_response}`
      });
    }

    // Check if this is a wallet funding transaction
    const metadata = transactionData.metadata;
    if (!metadata || metadata.purpose !== 'wallet_funding') {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction type"
      });
    }

    // Get user ID from metadata
    const userId = metadata.userId;
    const amount = metadata.amount;
    const description = metadata.description;

    // Get user wallet
    const wallet = await Wallet.getUserWallet(userId);

    // Check if transaction has already been processed
    const existingTransaction = await LedgerEntry.findOne({
      reference: `PAYMENT_VERIFIED_${reference}`,
      status: "completed"
    });

    if (existingTransaction) {
      return res.status(400).json({
        success: false,
        message: "Transaction already processed"
      });
    }

    // Find and update pending ledger entries
    const pendingEntries = await LedgerEntry.find({
      gatewayReference: reference,
      status: "pending"
    });

    if (pendingEntries.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No pending transaction found"
      });
    }

    const verifiedReference = generateReference("PAYMENT_VERIFIED");

    // Update pending entries to completed
    for (const entry of pendingEntries) {
      entry.status = "completed";
      entry.reference = verifiedReference;
      await entry.save();
    }

    // Update wallet balance
    await wallet.updateBalance(amount, "credit");

    // Update user statistics
    await User.findByIdAndUpdate(userId, {
      $inc: {
        totalTransactions: 1,
        totalDeposits: amount
      }
    });

    res.json({
      success: true,
      message: "Payment verified and wallet funded successfully",
      data: {
        transactionId: transactionData.id,
        reference: transactionData.reference,
        amount: amount,
        newBalance: wallet.balance,
        availableBalance: wallet.availableBalance,
        paidAt: transactionData.paid_at,
        paymentMethod: transactionData.channel,
        verifiedReference
      }
    });
  } catch (err) {
    console.error("Payment verification error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   GET TRANSACTION STATUS
========================= */
router.get("/status/:reference", auth, async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ message: "Reference is required" });
    }

    const result = await PaystackService.getTransaction(reference);

    if (result.success) {
      // Also check our ledger
      const ledgerEntry = await LedgerEntry.findOne({
        gatewayReference: reference,
        userId: req.user._id
      });

      res.json({
        success: true,
        data: {
          reference: result.data.reference,
          status: result.data.status,
          amount: result.data.amount / 100, // Convert from kobo
          paidAt: result.data.paid_at,
          gatewayResponse: result.data.gateway_response,
          channel: result.data.channel,
          internalStatus: ledgerEntry ? ledgerEntry.status : "not_found"
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || "Failed to get transaction status"
      });
    }
  } catch (err) {
    console.error("Transaction status error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   GET PAYMENT METHODS
========================= */
router.get("/methods", auth, async (req, res) => {
  try {
    const paymentMethods = [
      {
        id: "card",
        name: "Card Payment",
        description: "Pay with debit/credit card",
        icon: "card",
        supported: true,
        fees: "1.5% + ₦100"
      },
      {
        id: "bank_transfer",
        name: "Bank Transfer",
        description: "Transfer from your bank account",
        icon: "bank",
        supported: true,
        fees: "Free"
      },
      {
        id: "ussd",
        name: "USSD",
        description: "Pay with USSD code",
        icon: "phone",
        supported: true,
        fees: "Free"
      },
      {
        id: "virtual_account",
        name: "Virtual Account",
        description: "Transfer to dedicated account",
        icon: "account",
        supported: true,
        fees: "Free"
      }
    ];

    res.json({
      success: true,
      data: paymentMethods
    });
  } catch (err) {
    console.error("Get payment methods error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   GET PAYMENT HISTORY
========================= */
router.get("/history", auth, async (req, res) => {
  try {
    const { limit = 20, page = 1, status, method } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query
    const query = { 
      userId: req.user._id,
      transactionType: "deposit"
    };
    
    if (status) {
      query.status = status;
    }
    
    if (method) {
      query["metadata.paymentMethod"] = method;
    }
    
    // Get transactions
    const transactions = await LedgerEntry.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await LedgerEntry.countDocuments(query);

    res.json({
      success: true,
      data: {
        transactions: transactions.map(t => ({
          reference: t.reference,
          amount: t.credit,
          description: t.description,
          status: t.status,
          paymentMethod: t.metadata?.paymentMethod || "unknown",
          gatewayReference: t.gatewayReference,
          createdAt: t.createdAt,
          balance: t.balance
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          limit: parseInt(limit)
        }
      }
    });
  } catch (err) {
    console.error("Payment history error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   WEBHOOK HANDLER
========================= */
router.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const payload = req.body;

    // Verify webhook signature
    if (!PaystackService.verifyWebhookSignature(payload, signature)) {
      return res.status(401).json({ message: "Invalid webhook signature" });
    }

    const event = payload.event;

    // Handle successful charge
    if (event === 'charge.success') {
      const transactionData = payload.data;
      const metadata = transactionData.metadata;

      // Only process wallet funding transactions
      if (metadata && metadata.purpose === 'wallet_funding') {
        const userId = metadata.userId;
        const amount = metadata.amount;
        const description = metadata.description;
        const reference = transactionData.reference;

        try {
          // Get user wallet
          const wallet = await Wallet.getUserWallet(userId);

          // Check if transaction already processed
          const existingTransaction = await LedgerEntry.findOne({
            reference: `WEBHOOK_PROCESSED_${reference}`,
            status: "completed"
          });

          if (!existingTransaction) {
            // Find and update pending entries
            const pendingEntries = await LedgerEntry.find({
              gatewayReference: reference,
              status: "pending"
            });

            if (pendingEntries.length > 0) {
              const webhookReference = generateReference("WEBHOOK_PROCESSED");

              // Update pending entries
              for (const entry of pendingEntries) {
                entry.status = "completed";
                entry.reference = webhookReference;
                await entry.save();
              }

              // Update wallet balance
              await wallet.updateBalance(amount, "credit");

              // Update user statistics
              await User.findByIdAndUpdate(userId, {
                $inc: {
                  totalTransactions: 1,
                  totalDeposits: amount
                }
              });

              console.log(`Webhook processed: User ${userId}, Amount ${amount}, Reference ${reference}`);
            }
          }
        } catch (error) {
          console.error("Webhook processing error:", error);
        }
      }
    }

    // Handle failed charges
    if (event === 'charge.failed') {
      const transactionData = payload.data;
      const reference = transactionData.reference;

      // Update pending entries to failed
      await LedgerEntry.updateMany(
        { gatewayReference: reference, status: "pending" },
        { 
          status: "failed",
          description: `Payment failed: ${transactionData.gateway_response}`
        }
      );
    }

    // Handle transfer events
    if (event === 'transfer.success') {
      const transferData = payload.data;
      console.log('Transfer successful:', transferData.reference);
      
      // Update withdrawal ledger entries if needed
    }

    if (event === 'transfer.failed') {
      const transferData = payload.data;
      console.log('Transfer failed:', transferData.reference);
      
      // Handle failed transfers - refund wallet if needed
    }

    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

/* =========================
   GET PAYMENT STATISTICS
========================= */
router.get("/stats", auth, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const paymentStats = await LedgerEntry.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.user._id),
          transactionType: "deposit",
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            status: "$status",
            method: "$metadata.paymentMethod"
          },
          totalAmount: { $sum: "$credit" },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalStats = await LedgerEntry.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.user._id),
          transactionType: "deposit",
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$credit" },
          totalCount: { $sum: 1 },
          successfulAmount: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$credit", 0] }
          },
          successfulCount: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = totalStats[0] || { totalAmount: 0, totalCount: 0, successfulAmount: 0, successfulCount: 0 };

    res.json({
      success: true,
      data: {
        thirtyDayStats: {
          totalAmount: stats.totalAmount,
          totalCount: stats.totalCount,
          successfulAmount: stats.successfulAmount,
          successfulCount: stats.successfulCount,
          successRate: stats.totalCount > 0 ? (stats.successfulCount / stats.totalCount) * 100 : 0
        },
        breakdown: paymentStats.map(stat => ({
          status: stat._id.status,
          method: stat._id.method,
          totalAmount: stat.totalAmount,
          count: stat.count
        }))
      }
    });
  } catch (err) {
    console.error("Payment stats error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
