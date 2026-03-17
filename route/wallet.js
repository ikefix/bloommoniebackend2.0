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
   GET WALLET BALANCE
========================= */
router.get("/balance", auth, async (req, res) => {
  try {
    const wallet = await Wallet.getUserWallet(req.user._id);
    
    res.json({ 
      balance: wallet.balance,
      availableBalance: wallet.availableBalance,
      lockedBalance: wallet.lockedBalance,
      currency: wallet.currency,
      status: wallet.status,
      lastTransactionAt: wallet.lastTransactionAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   GET WALLET SUMMARY
========================= */
router.get("/summary", auth, async (req, res) => {
  try {
    const wallet = await Wallet.getUserWallet(req.user._id);
    const summary = await wallet.getSummary();
    
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   ADD MONEY TO WALLET (Manual/Admin)
========================= */
router.post("/add-money", auth, async (req, res) => {
  try {
    const { amount, description } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }
    
    if (!description) {
      return res.status(400).json({ message: "Description is required" });
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
      reference: generateReference("MANUAL_DEPOSIT"),
      amount
    });

    if (fraudCheck.action === "block") {
      return res.status(403).json({ 
        message: "Transaction blocked due to security concerns",
        riskScore: fraudCheck.riskScore
      });
    }

    const reference = generateReference("MANUAL_DEPOSIT");
    
    // Create double-entry ledger entries
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
        description,
        metadata: {
          paymentMethod: "manual",
          fraudCheckId: fraudCheck._id
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      {
        accountType: "system",
        accountId: new mongoose.Types.ObjectId(),
        userId: req.user._id,
        debit: amount,
        credit: 0,
        balance: 0,
        reference,
        transactionType: "settlement",
        description: `Manual deposit settlement: ${description}`,
        metadata: {
          paymentMethod: "manual",
          fraudCheckId: fraudCheck._id
        }
      }
    ]);

    // Update wallet balance
    await wallet.updateBalance(amount, "credit");

    res.json({ 
      message: "Money added successfully",
      newBalance: wallet.balance,
      availableBalance: wallet.availableBalance,
      transaction: {
        reference,
        type: "deposit",
        amount,
        description,
        balance: wallet.balance,
        timestamp: new Date()
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   WITHDRAW MONEY TO BANK ACCOUNT
========================= */
router.post("/withdraw", auth, async (req, res) => {
  try {
    const { amount, description, recipientCode } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }
    
    if (!description) {
      return res.status(400).json({ message: "Description is required" });
    }

    if (!recipientCode) {
      return res.status(400).json({ message: "Recipient code is required. Create a transfer recipient first." });
    }

    // Get user wallet
    const wallet = await Wallet.getUserWallet(req.user._id);
    
    if (wallet.status !== "active") {
      return res.status(403).json({ message: "Wallet is not active" });
    }
    
    if (wallet.availableBalance < amount) {
      return res.status(400).json({ message: "Insufficient available balance" });
    }
    
    // Check transaction limits
    await wallet.checkTransactionLimit(amount, "withdrawal");
    
    // Perform fraud detection
    const fraudCheck = await FraudDetection.analyzeTransaction({
      userId: req.user._id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      transactionType: "withdrawal",
      reference: generateReference("WITHDRAWAL"),
      amount
    });

    if (fraudCheck.action === "block") {
      return res.status(403).json({ 
        message: "Withdrawal blocked due to security concerns",
        riskScore: fraudCheck.riskScore
      });
    }

    // Lock funds temporarily
    await wallet.lockFunds(amount, "Bank withdrawal processing");

    const reference = generateReference("WITHDRAWAL");
    
    try {
      // Initiate transfer via Paystack
      const transferResult = await PaystackService.initiateTransfer(
        recipientCode,
        amount,
        description
      );

      if (!transferResult.success) {
        // Unlock funds if transfer failed
        await wallet.unlockFunds(amount);
        throw new Error(transferResult.message || "Transfer failed");
      }

      // Create double-entry ledger entries
      await LedgerEntry.createDoubleEntry([
        {
          accountType: "wallet",
          accountId: wallet._id,
          userId: req.user._id,
          debit: amount,
          credit: 0,
          balance: wallet.balance - amount,
          reference,
          transactionType: "withdrawal",
          description: `Bank transfer: ${transferResult.data.reference} - ${description}`,
          metadata: {
            paymentMethod: "bank_transfer",
            recipientCode,
            transferReference: transferResult.data.reference,
            fraudCheckId: fraudCheck._id
          },
          gatewayReference: transferResult.data.reference,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        },
        {
          accountType: "settlement",
          accountId: new mongoose.Types.ObjectId(),
          userId: req.user._id,
          debit: 0,
          credit: amount,
          balance: 0,
          reference,
          transactionType: "settlement",
          description: `Bank transfer settlement: ${transferResult.data.reference}`,
          metadata: {
            paymentMethod: "bank_transfer",
            recipientCode,
            transferReference: transferResult.data.reference
          }
        }
      ]);

      // Update wallet balance (funds already locked)
      wallet.balance -= amount;
      wallet.lastTransactionAt = new Date();
      await wallet.save();

      res.json({ 
        message: "Withdrawal initiated successfully",
        newBalance: wallet.balance,
        availableBalance: wallet.availableBalance,
        lockedBalance: wallet.lockedBalance,
        transfer: {
          reference: transferResult.data.reference,
          amount: amount,
          description,
          recipientCode,
          status: "pending",
          transferCode: transferResult.data.transfer_code
        },
        transaction: {
          reference,
          type: "withdrawal",
          amount,
          description: `Bank transfer: ${transferResult.data.reference} - ${description}`,
          balance: wallet.balance,
          timestamp: new Date()
        }
      });
    } catch (transferError) {
      // Unlock funds on transfer failure
      await wallet.unlockFunds(amount);
      throw transferError;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   TRANSFER MONEY TO ANOTHER USER
========================= */
router.post("/transfer", auth, async (req, res) => {
  try {
    const { recipientPhone, amount, description } = req.body;
    
    if (!recipientPhone || !amount || amount <= 0 || !description) {
      return res.status(400).json({ message: "All fields are required and amount must be greater than 0" });
    }

    // Get sender's wallet
    const senderWallet = await Wallet.getUserWallet(req.user._id);
    
    if (senderWallet.availableBalance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Check transaction limits
    await senderWallet.checkTransactionLimit(amount, "transfer");
    
    // Find recipient
    const recipient = await User.findOne({ phone: recipientPhone });
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    if (recipient._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot transfer to yourself" });
    }

    // Get recipient's wallet
    const recipientWallet = await Wallet.getUserWallet(recipient._id);
    
    if (recipientWallet.status !== "active") {
      return res.status(400).json({ message: "Recipient wallet is not active" });
    }

    // Perform fraud detection
    const fraudCheck = await FraudDetection.analyzeTransaction({
      userId: req.user._id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      transactionType: "transfer",
      reference: generateReference("TRANSFER"),
      amount
    });

    if (fraudCheck.action === "block") {
      return res.status(403).json({ 
        message: "Transfer blocked due to security concerns",
        riskScore: fraudCheck.riskScore
      });
    }

    const reference = generateReference("TRANSFER");
    
    // Create double-entry ledger entries
    await LedgerEntry.createDoubleEntry([
      {
        accountType: "wallet",
        accountId: senderWallet._id,
        userId: req.user._id,
        debit: amount,
        credit: 0,
        balance: senderWallet.balance - amount,
        reference,
        transactionType: "transfer_out",
        description: `Transfer to ${recipient.name}: ${description}`,
        metadata: {
          recipientId: recipient._id,
          recipientPhone: recipient.phone,
          fraudCheckId: fraudCheck._id
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      {
        accountType: "wallet",
        accountId: recipientWallet._id,
        userId: recipient._id,
        debit: 0,
        credit: amount,
        balance: recipientWallet.balance + amount,
        reference,
        transactionType: "transfer_in",
        description: `Transfer from ${req.user.name}: ${description}`,
        metadata: {
          senderId: req.user._id,
          senderPhone: req.user.phone
        }
      }
    ]);

    // Update both wallets
    await senderWallet.updateBalance(amount, "debit");
    await recipientWallet.updateBalance(amount, "credit");

    res.json({ 
      message: "Transfer successful",
      senderBalance: senderWallet.balance,
      senderAvailableBalance: senderWallet.availableBalance,
      recipientName: recipient.name,
      transaction: {
        reference,
        type: "transfer_out",
        amount,
        description,
        toUser: recipient.name,
        toPhone: recipient.phone,
        balance: senderWallet.balance,
        timestamp: new Date()
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   GET TRANSACTION HISTORY
========================= */
router.get("/transactions", auth, async (req, res) => {
  try {
    const { limit = 20, page = 1, type, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query
    const query = { userId: req.user._id, status: "completed" };
    
    if (type) {
      query.transactionType = type;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Get transactions
    const transactions = await LedgerEntry.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await LedgerEntry.countDocuments(query);
    
    // Populate user details for transfers
    const populatedTransactions = await Promise.all(
      transactions.map(async (transaction) => {
        const populated = { ...transaction.toObject() };
        
        if (transaction.metadata.recipientId) {
          const recipient = await User.findById(transaction.metadata.recipientId).select('name phone');
          populated.recipientDetails = recipient;
        }
        
        if (transaction.metadata.senderId) {
          const sender = await User.findById(transaction.metadata.senderId).select('name phone');
          populated.senderDetails = sender;
        }
        
        return populated;
      })
    );

    res.json({
      transactions: populatedTransactions.map(t => ({
        reference: t.reference,
        type: t.transactionType,
        amount: t.credit || t.debit,
        description: t.description,
        balance: t.balance,
        metadata: t.metadata,
        createdAt: t.createdAt,
        recipientDetails: t.recipientDetails,
        senderDetails: t.senderDetails
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   CREATE TRANSFER RECIPIENT
========================= */
router.post("/create-recipient", auth, async (req, res) => {
  try {
    const { name, accountNumber, bankCode } = req.body;

    if (!name || !accountNumber || !bankCode) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // First resolve the account to verify details
    const resolveResult = await PaystackService.resolveAccount(accountNumber, bankCode);
    if (!resolveResult.success) {
      return res.status(400).json({
        message: "Invalid account details",
        error: resolveResult.message
      });
    }

    // Create transfer recipient
    const result = await PaystackService.createTransferRecipient(
      "nuban",
      name,
      accountNumber,
      bankCode
    );

    if (result.success) {
      res.json({
        message: "Transfer recipient created successfully",
        recipient: result.data
      });
    } else {
      res.status(400).json({
        message: "Failed to create transfer recipient",
        error: result.message
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   GET BANKS LIST
========================= */
router.get("/banks", auth, async (req, res) => {
  try {
    const result = await PaystackService.getBanks();

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || "Failed to get banks list"
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   RESOLVE BANK ACCOUNT
========================= */
router.post("/resolve-account", auth, async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;

    if (!accountNumber || !bankCode) {
      return res.status(400).json({ message: "Account number and bank code are required" });
    }

    const result = await PaystackService.resolveAccount(accountNumber, bankCode);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || "Failed to resolve account"
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   LOCK/UNLOCK FUNDS
========================= */
router.post("/lock-funds", auth, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }
    
    if (!reason) {
      return res.status(400).json({ message: "Reason is required" });
    }

    const wallet = await Wallet.getUserWallet(req.user._id);
    const result = await wallet.lockFunds(amount, reason);
    
    res.json({
      message: "Funds locked successfully",
      ...result
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

router.post("/unlock-funds", auth, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    const wallet = await Wallet.getUserWallet(req.user._id);
    const result = await wallet.unlockFunds(amount);
    
    res.json({
      message: "Funds unlocked successfully",
      ...result
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
