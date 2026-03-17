import { Router } from "express";
import User from "../models/user.js";
import SavingsPlan from "../models/savingsPlan.js";
import Wallet from "../models/wallet.js";
import LedgerEntry from "../models/ledger.js";
import FraudDetection from "../models/fraudDetection.js";
import auth from "../middlewares/auth.js";
import crypto from "crypto";
import mongoose from "mongoose";

const router = Router();

// Helper function to generate unique reference
const generateReference = (prefix) => {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

/* =========================
   CREATE SAVINGS PLAN
========================= */
router.post("/create", auth, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      type, 
      targetAmount, 
      interestRate, 
      maturityDate,
      autoSave,
      withdrawalRules 
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({ message: "Name and type are required" });
    }

    if (!["fixed", "flexible", "target", "goal"].includes(type)) {
      return res.status(400).json({ message: "Invalid savings type" });
    }

    if ((type === "target" || type === "goal") && (!targetAmount || targetAmount <= 0)) {
      return res.status(400).json({ message: "Target amount is required for target/goal savings" });
    }

    if (type === "fixed" && !maturityDate) {
      return res.status(400).json({ message: "Maturity date is required for fixed savings" });
    }

    // Get user wallet
    const wallet = await Wallet.getUserWallet(req.user._id);

    // Create savings plan
    const savingsPlan = new SavingsPlan({
      userId: req.user._id,
      name,
      description: description || "",
      type,
      targetAmount: targetAmount || 0,
      interestRate: interestRate || 0,
      maturityDate: maturityDate || null,
      autoSave: autoSave || { enabled: false, frequency: "monthly", amount: 0 },
      withdrawalRules: withdrawalRules || {
        penaltyFee: type === "fixed" ? 10 : 0, // 10% penalty for fixed savings
        minWithdrawalAmount: 1000,
        maxWithdrawalsPerMonth: type === "fixed" ? 0 : 3,
        requiresApproval: type === "fixed"
      }
    });

    await savingsPlan.save();

    // Update user's savings plans
    await User.findByIdAndUpdate(req.user._id, {
      $push: { savingsPlans: savingsPlan._id }
    });

    res.json({
      message: "Savings plan created successfully",
      savingsPlan: {
        id: savingsPlan._id,
        name: savingsPlan.name,
        type: savingsPlan.type,
        targetAmount: savingsPlan.targetAmount,
        currentAmount: savingsPlan.currentAmount,
        interestRate: savingsPlan.interestRate,
        maturityDate: savingsPlan.maturityDate,
        status: savingsPlan.status,
        progressPercentage: savingsPlan.progressPercentage,
        daysToMaturity: savingsPlan.daysToMaturity,
        autoSave: savingsPlan.autoSave,
        withdrawalRules: savingsPlan.withdrawalRules,
        createdAt: savingsPlan.createdAt
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   GET USER SAVINGS PLANS
========================= */
router.get("/", auth, async (req, res) => {
  try {
    const { status, type } = req.query;
    
    const savingsPlans = await SavingsPlan.getUserSavingsPlans(req.user._id, status);
    
    // Filter by type if specified
    const filteredPlans = type ? 
      savingsPlans.filter(plan => plan.type === type) : 
      savingsPlans;

    res.json({
      savingsPlans: filteredPlans.map(plan => ({
        id: plan._id,
        name: plan.name,
        description: plan.description,
        type: plan.type,
        targetAmount: plan.targetAmount,
        currentAmount: plan.currentAmount,
        interestRate: plan.interestRate,
        maturityDate: plan.maturityDate,
        status: plan.status,
        progressPercentage: plan.progressPercentage,
        daysToMaturity: plan.daysToMaturity,
        isMatured: plan.isMatured,
        availableBalance: plan.availableBalance,
        autoSave: plan.autoSave,
        withdrawalRules: plan.withdrawalRules,
        contributions: plan.contributions.length,
        withdrawals: plan.withdrawals.length,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   GET SAVINGS PLAN DETAILS
========================= */
router.get("/:id", auth, async (req, res) => {
  try {
    const savingsPlan = await SavingsPlan.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!savingsPlan) {
      return res.status(404).json({ message: "Savings plan not found" });
    }

    const interest = savingsPlan.calculateInterest();

    res.json({
      savingsPlan: {
        id: savingsPlan._id,
        name: savingsPlan.name,
        description: savingsPlan.description,
        type: savingsPlan.type,
        targetAmount: savingsPlan.targetAmount,
        currentAmount: savingsPlan.currentAmount,
        interestRate: savingsPlan.interestRate,
        accruedInterest: interest,
        maturityDate: savingsPlan.maturityDate,
        status: savingsPlan.status,
        progressPercentage: savingsPlan.progressPercentage,
        daysToMaturity: savingsPlan.daysToMaturity,
        isMatured: savingsPlan.isMatured,
        availableBalance: savingsPlan.availableBalance,
        autoSave: savingsPlan.autoSave,
        withdrawalRules: savingsPlan.withdrawalRules,
        contributions: savingsPlan.contributions.map(c => ({
          amount: c.amount,
          reference: c.reference,
          description: c.description,
          createdAt: c.createdAt
        })),
        withdrawals: savingsPlan.withdrawals.map(w => ({
          amount: w.amount,
          reference: w.reference,
          description: w.description,
          penaltyFee: w.penaltyFee,
          status: w.status,
          createdAt: w.createdAt,
          processedAt: w.processedAt
        })),
        createdAt: savingsPlan.createdAt,
        updatedAt: savingsPlan.updatedAt
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   ADD CONTRIBUTION TO SAVINGS PLAN
========================= */
router.post("/:id/contribute", auth, async (req, res) => {
  try {
    const { amount, description } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    const savingsPlan = await SavingsPlan.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!savingsPlan) {
      return res.status(404).json({ message: "Savings plan not found" });
    }

    if (savingsPlan.status !== "active") {
      return res.status(400).json({ message: "Cannot contribute to inactive savings plan" });
    }

    // Get user wallet
    const wallet = await Wallet.getUserWallet(req.user._id);
    
    if (wallet.availableBalance < amount) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    // Perform fraud detection
    const fraudCheck = await FraudDetection.analyzeTransaction({
      userId: req.user._id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      transactionType: "deposit",
      reference: generateReference("SAVINGS_CONTRIBUTION"),
      amount
    });

    if (fraudCheck.action === "block") {
      return res.status(403).json({ 
        message: "Contribution blocked due to security concerns",
        riskScore: fraudCheck.riskScore
      });
    }

    const reference = generateReference("SAVINGS_CONTRIBUTION");
    
    // Create ledger entries for wallet debit and savings credit
    await LedgerEntry.createDoubleEntry([
      {
        accountType: "wallet",
        accountId: wallet._id,
        userId: req.user._id,
        debit: amount,
        credit: 0,
        balance: wallet.balance - amount,
        reference,
        transactionType: "transfer_out",
        description: `Contribution to ${savingsPlan.name}: ${description || "Savings contribution"}`,
        metadata: {
          savingsPlanId: savingsPlan._id,
          savingsPlanName: savingsPlan.name,
          fraudCheckId: fraudCheck._id
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      {
        accountType: "savings",
        accountId: savingsPlan._id,
        userId: req.user._id,
        debit: 0,
        credit: amount,
        balance: savingsPlan.currentAmount + amount,
        reference,
        transactionType: "deposit",
        description: `Contribution from wallet: ${description || "Savings contribution"}`,
        metadata: {
          walletId: wallet._id,
          savingsPlanType: savingsPlan.type
        }
      }
    ]);

    // Update wallet balance
    await wallet.updateBalance(amount, "debit");

    // Add contribution to savings plan
    await savingsPlan.addContribution(amount, reference, description || "Savings contribution");

    res.json({
      message: "Contribution added successfully",
      walletBalance: wallet.balance,
      walletAvailableBalance: wallet.availableBalance,
      savingsPlan: {
        id: savingsPlan._id,
        name: savingsPlan.name,
        currentAmount: savingsPlan.currentAmount,
        targetAmount: savingsPlan.targetAmount,
        progressPercentage: savingsPlan.progressPercentage,
        contribution: {
          amount,
          reference,
          description: description || "Savings contribution",
          timestamp: new Date()
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   REQUEST WITHDRAWAL FROM SAVINGS PLAN
========================= */
router.post("/:id/withdraw", auth, async (req, res) => {
  try {
    const { amount, description } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    const savingsPlan = await SavingsPlan.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!savingsPlan) {
      return res.status(404).json({ message: "Savings plan not found" });
    }

    // Request withdrawal
    const withdrawal = await savingsPlan.requestWithdrawal(amount, description || "Savings withdrawal");

    res.json({
      message: savingsPlan.withdrawalRules.requiresApproval ? 
        "Withdrawal request submitted for approval" : 
        "Withdrawal processed successfully",
      withdrawal: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        reference: withdrawal.reference,
        description: withdrawal.description,
        penaltyFee: withdrawal.penaltyFee,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
        requiresApproval: savingsPlan.withdrawalRules.requiresApproval
      },
      savingsPlan: {
        id: savingsPlan._id,
        name: savingsPlan.name,
        currentAmount: savingsPlan.currentAmount,
        availableBalance: savingsPlan.availableBalance
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   GET SAVINGS PLAN TRANSACTIONS
========================= */
router.get("/:id/transactions", auth, async (req, res) => {
  try {
    const { limit = 20, page = 1, type } = req.query;
    const skip = (page - 1) * limit;

    const savingsPlan = await SavingsPlan.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!savingsPlan) {
      return res.status(404).json({ message: "Savings plan not found" });
    }

    let transactions = [];

    // Add contributions
    if (!type || type === "contribution") {
      transactions.push(...savingsPlan.contributions.map(c => ({
        type: "contribution",
        amount: c.amount,
        reference: c.reference,
        description: c.description,
        createdAt: c.createdAt
      })));
    }

    // Add withdrawals
    if (!type || type === "withdrawal") {
      transactions.push(...savingsPlan.withdrawals.map(w => ({
        type: "withdrawal",
        amount: w.amount,
        reference: w.reference,
        description: w.description,
        penaltyFee: w.penaltyFee,
        status: w.status,
        createdAt: w.createdAt,
        processedAt: w.processedAt
      })));
    }

    // Sort by date
    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Paginate
    const totalCount = transactions.length;
    const paginatedTransactions = transactions.slice(skip, skip + parseInt(limit));

    res.json({
      transactions: paginatedTransactions,
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
   UPDATE SAVINGS PLAN
========================= */
router.put("/:id", auth, async (req, res) => {
  try {
    const { name, description, autoSave, withdrawalRules } = req.body;

    const savingsPlan = await SavingsPlan.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!savingsPlan) {
      return res.status(404).json({ message: "Savings plan not found" });
    }

    if (savingsPlan.status === "terminated") {
      return res.status(400).json({ message: "Cannot update terminated savings plan" });
    }

    // Update allowed fields
    if (name) savingsPlan.name = name;
    if (description !== undefined) savingsPlan.description = description;
    if (autoSave) savingsPlan.autoSave = { ...savingsPlan.autoSave, ...autoSave };
    if (withdrawalRules) savingsPlan.withdrawalRules = { ...savingsPlan.withdrawalRules, ...withdrawalRules };

    await savingsPlan.save();

    res.json({
      message: "Savings plan updated successfully",
      savingsPlan: {
        id: savingsPlan._id,
        name: savingsPlan.name,
        description: savingsPlan.description,
        autoSave: savingsPlan.autoSave,
        withdrawalRules: savingsPlan.withdrawalRules,
        updatedAt: savingsPlan.updatedAt
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   CLOSE SAVINGS PLAN
========================= */
router.post("/:id/close", auth, async (req, res) => {
  try {
    const { reason } = req.body;

    const savingsPlan = await SavingsPlan.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!savingsPlan) {
      return res.status(404).json({ message: "Savings plan not found" });
    }

    if (savingsPlan.status === "terminated") {
      return res.status(400).json({ message: "Savings plan already terminated" });
    }

    // Check if plan can be closed
    if (savingsPlan.type === "fixed" && savingsPlan.status === "active" && !savingsPlan.isMatured) {
      return res.status(400).json({ message: "Cannot close fixed savings before maturity date" });
    }

    // Get user wallet
    const wallet = await Wallet.getUserWallet(req.user._id);

    const reference = generateReference("SAVINGS_CLOSURE");
    const totalAmount = savingsPlan.currentAmount;

    // Create ledger entries for savings closure
    await LedgerEntry.createDoubleEntry([
      {
        accountType: "savings",
        accountId: savingsPlan._id,
        userId: req.user._id,
        debit: totalAmount,
        credit: 0,
        balance: 0,
        reference,
        transactionType: "withdrawal",
        description: `Savings plan closure: ${reason || "Plan closure"}`,
        metadata: {
          savingsPlanName: savingsPlan.name,
          savingsPlanType: savingsPlan.type,
          closureReason: reason
        }
      },
      {
        accountType: "wallet",
        accountId: wallet._id,
        userId: req.user._id,
        debit: 0,
        credit: totalAmount,
        balance: wallet.balance + totalAmount,
        reference,
        transactionType: "transfer_in",
        description: `Savings plan closure: ${savingsPlan.name}`,
        metadata: {
          savingsPlanId: savingsPlan._id,
          savingsPlanName: savingsPlan.name
        }
      }
    ]);

    // Update wallet balance
    await wallet.updateBalance(totalAmount, "credit");

    // Update savings plan status
    savingsPlan.status = "withdrawn";
    savingsPlan.currentAmount = 0;
    await savingsPlan.save();

    res.json({
      message: "Savings plan closed successfully",
      walletBalance: wallet.balance,
      walletAvailableBalance: wallet.availableBalance,
      closedAmount: totalAmount,
      savingsPlan: {
        id: savingsPlan._id,
        name: savingsPlan.name,
        status: savingsPlan.status,
        closedAt: new Date()
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   GET SAVINGS STATISTICS
========================= */
router.get("/stats/overview", auth, async (req, res) => {
  try {
    const savingsPlans = await SavingsPlan.getUserSavingsPlans(req.user._id);
    
    const totalSavings = savingsPlans.reduce((sum, plan) => sum + plan.currentAmount, 0);
    const totalTarget = savingsPlans.reduce((sum, plan) => sum + plan.targetAmount, 0);
    const activePlans = savingsPlans.filter(plan => plan.status === "active").length;
    const maturedPlans = savingsPlans.filter(plan => plan.status === "matured").length;
    
    const totalInterest = savingsPlans.reduce((sum, plan) => sum + plan.calculateInterest(), 0);
    
    const byType = savingsPlans.reduce((acc, plan) => {
      acc[plan.type] = (acc[plan.type] || 0) + plan.currentAmount;
      return acc;
    }, {});

    res.json({
      overview: {
        totalSavings,
        totalTarget,
        totalInterest,
        activePlans,
        maturedPlans,
        totalPlans: savingsPlans.length,
        averageProgress: totalTarget > 0 ? (totalSavings / totalTarget) * 100 : 0
      },
      breakdown: {
        byType,
        byStatus: {
          active: activePlans,
          matured: maturedPlans,
          withdrawn: savingsPlans.filter(p => p.status === "withdrawn").length,
          terminated: savingsPlans.filter(p => p.status === "terminated").length
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
