import { Router } from "express";
import User from "../models/user.js";
import VirtualAccount from "../models/virtualAccount.js";
import Wallet from "../models/wallet.js";
import LedgerEntry from "../models/ledger.js";
import FraudDetection from "../models/fraudDetection.js";
import auth from "../middlewares/auth.js";
import crypto from "crypto";

const router = Router();

/* =========================
   CREATE VIRTUAL ACCOUNT
========================= */
router.post("/create", auth, async (req, res) => {
  try {
    const { accountName, provider = "paystack" } = req.body;
    
    if (!accountName) {
      return res.status(400).json({ message: "Account name is required" });
    }

    // Check if user already has virtual account
    const existingAccount = await VirtualAccount.findOne({ userId: req.user._id });
    if (existingAccount) {
      return res.status(400).json({ message: "User already has a virtual account" });
    }

    // Check if user has wallet
    const wallet = await Wallet.getUserWallet(req.user._id);

    // Perform fraud detection
    const fraudCheck = await FraudDetection.analyzeTransaction({
      userId: req.user._id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      transactionType: "account_creation",
      reference: `VA_CREATE_${req.user._id}_${Date.now()}`,
      amount: 0
    });

    if (fraudCheck.action === "block") {
      return res.status(403).json({ 
        message: "Account creation blocked due to security concerns",
        riskScore: fraudCheck.riskScore
      });
    }

    // Create virtual account
    const virtualAccount = await VirtualAccount.createVirtualAccount(
      req.user._id,
      accountName,
      provider
    );

    // Create ledger entry for account creation
    const reference = `VA_CREATE_${virtualAccount._id}`;
    await LedgerEntry.createDoubleEntry([
      {
        accountType: "system",
        accountId: new mongoose.Types.ObjectId(),
        userId: req.user._id,
        debit: 0,
        credit: 0,
        balance: 0,
        reference,
        transactionType: "deposit",
        description: `Virtual account created: ${virtualAccount.accountNumber}`,
        metadata: { virtualAccountId: virtualAccount._id, provider }
      }
    ]);

    res.json({
      message: "Virtual account created successfully",
      virtualAccount: {
        accountName: virtualAccount.accountName,
        accountNumber: virtualAccount.accountNumber,
        bankName: virtualAccount.bankName,
        bankCode: virtualAccount.bankCode,
        provider: virtualAccount.provider,
        isActive: virtualAccount.isActive,
        restrictions: virtualAccount.restrictions
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   GET USER VIRTUAL ACCOUNT
========================= */
router.get("/", auth, async (req, res) => {
  try {
    const virtualAccount = await VirtualAccount.getUserVirtualAccount(req.user._id);
    
    if (!virtualAccount) {
      return res.status(404).json({ message: "Virtual account not found" });
    }

    res.json({
      virtualAccount: {
        accountName: virtualAccount.accountName,
        accountNumber: virtualAccount.accountNumber,
        bankName: virtualAccount.bankName,
        bankCode: virtualAccount.bankCode,
        provider: virtualAccount.provider,
        isActive: virtualAccount.isActive,
        restrictions: virtualAccount.restrictions,
        totalReceived: virtualAccount.totalReceived,
        lastTransactionAt: virtualAccount.lastTransactionAt,
        createdAt: virtualAccount.createdAt
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   UPDATE VIRTUAL ACCOUNT RESTRICTIONS
========================= */
router.put("/restrictions", auth, async (req, res) => {
  try {
    const { singleTransactionLimit, dailyTransactionLimit, allowedSources } = req.body;
    
    const virtualAccount = await VirtualAccount.getUserVirtualAccount(req.user._id);
    if (!virtualAccount) {
      return res.status(404).json({ message: "Virtual account not found" });
    }

    // Update restrictions
    if (singleTransactionLimit) {
      virtualAccount.restrictions.singleTransactionLimit = singleTransactionLimit;
    }
    
    if (dailyTransactionLimit) {
      virtualAccount.restrictions.dailyTransactionLimit = dailyTransactionLimit;
    }
    
    if (allowedSources) {
      virtualAccount.restrictions.allowedSources = allowedSources;
    }

    await virtualAccount.save();

    res.json({
      message: "Virtual account restrictions updated successfully",
      restrictions: virtualAccount.restrictions
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   DEACTIVATE VIRTUAL ACCOUNT
========================= */
router.delete("/deactivate", auth, async (req, res) => {
  try {
    const virtualAccount = await VirtualAccount.getUserVirtualAccount(req.user._id);
    if (!virtualAccount) {
      return res.status(404).json({ message: "Virtual account not found" });
    }

    await VirtualAccount.deactivateVirtualAccount(req.user._id);

    res.json({
      message: "Virtual account deactivated successfully"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   WEBHOOK FOR VIRTUAL ACCOUNT PAYMENTS
========================= */
router.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const payload = req.body;

    // Verify webhook signature (implement proper verification)
    if (!signature) {
      return res.status(401).send('Webhook signature required');
    }

    const event = payload.event;

    if (event === 'charge.success') {
      const transactionData = payload.data;
      
      // Find virtual account by account number
      const virtualAccount = await VirtualAccount.findOne({
        accountNumber: transactionData.authorization.account_number
      });

      if (!virtualAccount) {
        console.log('Virtual account not found for transaction');
        return res.status(200).send('Webhook processed');
      }

      const amount = transactionData.amount / 100; // Convert from kobo
      const reference = transactionData.reference;

      // Check if transaction already processed
      const existingLedger = await LedgerEntry.findOne({ 
        reference: `VA_PAYMENT_${reference}` 
      });

      if (existingLedger) {
        return res.status(200).send('Transaction already processed');
      }

      // Check transaction limits
      await virtualAccount.checkTransactionLimit(amount, transactionData.paid_at);

      // Get user wallet
      const wallet = await Wallet.getUserWallet(virtualAccount.userId);

      // Create double-entry ledger entries
      const ledgerReference = `VA_PAYMENT_${reference}`;
      await LedgerEntry.createDoubleEntry([
        {
          accountType: "wallet",
          accountId: wallet._id,
          userId: virtualAccount.userId,
          debit: 0,
          credit: amount,
          balance: wallet.balance + amount,
          reference: ledgerReference,
          transactionType: "deposit",
          description: `Virtual account payment: ${reference}`,
          metadata: {
            virtualAccountId: virtualAccount._id,
            paymentMethod: "virtual_account",
            gatewayReference: reference
          },
          gatewayReference: reference
        },
        {
          accountType: "settlement",
          accountId: new mongoose.Types.ObjectId(),
          userId: virtualAccount.userId,
          debit: amount,
          credit: 0,
          balance: 0,
          reference: ledgerReference,
          transactionType: "settlement",
          description: `Settlement for virtual account payment: ${reference}`,
          metadata: {
            virtualAccountId: virtualAccount._id,
            paymentMethod: "virtual_account",
            gatewayReference: reference
          }
        }
      ]);

      // Update wallet balance
      await wallet.updateBalance(amount, "credit");

      // Update virtual account stats
      await virtualAccount.updateTransactionStats(amount);

      console.log(`Virtual account payment processed: ${virtualAccount.accountNumber}, Amount: ${amount}`);
    }

    res.status(200).send('Webhook processed successfully');

  } catch (err) {
    console.error('Virtual account webhook error:', err);
    res.status(500).send('Webhook processing failed');
  }
});

/* =========================
   GET VIRTUAL ACCOUNT TRANSACTIONS
========================= */
router.get("/transactions", auth, async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const virtualAccount = await VirtualAccount.getUserVirtualAccount(req.user._id);
    if (!virtualAccount) {
      return res.status(404).json({ message: "Virtual account not found" });
    }

    // Get ledger entries for virtual account payments
    const transactions = await LedgerEntry.find({
      userId: req.user._id,
      transactionType: "deposit",
      "metadata.paymentMethod": "virtual_account"
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const totalCount = await LedgerEntry.countDocuments({
      userId: req.user._id,
      transactionType: "deposit",
      "metadata.paymentMethod": "virtual_account"
    });

    res.json({
      transactions: transactions.map(t => ({
        reference: t.reference,
        amount: t.credit,
        description: t.description,
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
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
