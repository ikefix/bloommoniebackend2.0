import { Router } from "express";
import User from "../models/user.js";
import SavingsPlan from "../models/savingsPlan.js";
import LedgerEntry from "../models/ledger.js";
import auth from "../middlewares/auth.js";
import mongoose from "mongoose";

const router = Router();

/* =========================
   GET FEE SUMMARY FOR SAVINGS PLAN
========================= */
router.get("/:id/fees", auth, async (req, res) => {
  try {
    const savingsPlan = await SavingsPlan.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!savingsPlan) {
      return res.status(404).json({ message: "Savings plan not found" });
    }

    const feeSummary = savingsPlan.getFeeSummary();

    res.json({
      success: true,
      data: {
        savingsPlanId: savingsPlan._id,
        savingsPlanName: savingsPlan.name,
        currentBalance: savingsPlan.currentAmount,
        feeSummary
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   DEDUCT PENDING FEES
========================= */
router.post("/:id/deduct-fees", auth, async (req, res) => {
  try {
    const savingsPlan = await SavingsPlan.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!savingsPlan) {
      return res.status(404).json({ message: "Savings plan not found" });
    }

    if (savingsPlan.status !== "active") {
      return res.status(400).json({ message: "Cannot deduct fees from inactive savings plan" });
    }

    const deductions = await savingsPlan.deductFees();

    res.json({
      success: true,
      message: "Fees deducted successfully",
      data: {
        deductions,
        newBalance: savingsPlan.currentAmount,
        deductionDate: new Date()
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   CALCULATE TRANSACTION FEE
========================= */
router.post("/:id/calculate-fee", auth, async (req, res) => {
  try {
    const { amount, transactionType } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    if (!transactionType || !["contribution", "withdrawal", "transfer"].includes(transactionType)) {
      return res.status(400).json({ message: "Invalid transaction type" });
    }

    const savingsPlan = await SavingsPlan.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!savingsPlan) {
      return res.status(404).json({ message: "Savings plan not found" });
    }

    const fee = savingsPlan.calculateTransactionFee(amount, transactionType);
    let netAmount = amount - fee;

    // Add penalty fee for early withdrawals
    let penaltyFee = 0;
    if (transactionType === "withdrawal" && savingsPlan.maturityDate) {
      if (new Date() < new Date(savingsPlan.maturityDate)) {
        penaltyFee = (amount * savingsPlan.withdrawalRules.penaltyFee) / 100;
        netAmount -= penaltyFee;
      }
    }

    // Add withdrawal fee
    let withdrawalFee = 0;
    if (transactionType === "withdrawal") {
      withdrawalFee = (amount * savingsPlan.withdrawalRules.withdrawalFee) / 100;
      netAmount -= withdrawalFee;
    }

    res.json({
      success: true,
      data: {
        amount,
        transactionType,
        fees: {
          transactionFee: fee,
          penaltyFee,
          withdrawalFee,
          totalFees: fee + penaltyFee + withdrawalFee
        },
        netAmount,
        feeBreakdown: {
          transactionFeeRate: `${savingsPlan.fees.transactionFees[transactionType]}%`,
          penaltyFeeRate: `${savingsPlan.withdrawalRules.penaltyFee}%`,
          withdrawalFeeRate: `${savingsPlan.withdrawalRules.withdrawalFee}%`
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   UPDATE FEE STRUCTURE
========================= */
router.put("/:id/fees", auth, async (req, res) => {
  try {
    const { 
      managementFee, 
      managementFeeFrequency,
      transactionFees,
      maintenanceFee,
      maintenanceFeeWaiver,
      withdrawalRules 
    } = req.body;

    const savingsPlan = await SavingsPlan.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!savingsPlan) {
      return res.status(404).json({ message: "Savings plan not found" });
    }

    if (savingsPlan.status === "terminated") {
      return res.status(400).json({ message: "Cannot update fees for terminated savings plan" });
    }

    // Update fee structure
    if (managementFee !== undefined) {
      if (managementFee < 0 || managementFee > 20) {
        return res.status(400).json({ message: "Management fee must be between 0% and 20%" });
      }
      savingsPlan.fees.managementFee = managementFee;
    }

    if (managementFeeFrequency) {
      if (!["monthly", "quarterly", "annually"].includes(managementFeeFrequency)) {
        return res.status(400).json({ message: "Invalid management fee frequency" });
      }
      savingsPlan.fees.managementFeeFrequency = managementFeeFrequency;
    }

    if (transactionFees) {
      if (transactionFees.contribution !== undefined) {
        if (transactionFees.contribution < 0 || transactionFees.contribution > 10) {
          return res.status(400).json({ message: "Contribution fee must be between 0% and 10%" });
        }
        savingsPlan.fees.transactionFees.contribution = transactionFees.contribution;
      }

      if (transactionFees.withdrawal !== undefined) {
        if (transactionFees.withdrawal < 0 || transactionFees.withdrawal > 10) {
          return res.status(400).json({ message: "Withdrawal fee must be between 0% and 10%" });
        }
        savingsPlan.fees.transactionFees.withdrawal = transactionFees.withdrawal;
      }

      if (transactionFees.transfer !== undefined) {
        if (transactionFees.transfer < 0 || transactionFees.transfer > 10) {
          return res.status(400).json({ message: "Transfer fee must be between 0% and 10%" });
        }
        savingsPlan.fees.transactionFees.transfer = transactionFees.transfer;
      }
    }

    if (maintenanceFee !== undefined) {
      if (maintenanceFee < 0 || maintenanceFee > 5000) {
        return res.status(400).json({ message: "Maintenance fee must be between ₦0 and ₦5,000" });
      }
      savingsPlan.fees.maintenanceFee = maintenanceFee;
    }

    if (maintenanceFeeWaiver !== undefined) {
      if (maintenanceFeeWaiver < 0 || maintenanceFeeWaiver > 1000000) {
        return res.status(400).json({ message: "Maintenance fee waiver must be between ₦0 and ₦1,000,000" });
      }
      savingsPlan.fees.maintenanceFeeWaiver = maintenanceFeeWaiver;
    }

    if (withdrawalRules) {
      if (withdrawalRules.penaltyFee !== undefined) {
        if (withdrawalRules.penaltyFee < 0 || withdrawalRules.penaltyFee > 50) {
          return res.status(400).json({ message: "Penalty fee must be between 0% and 50%" });
        }
        savingsPlan.withdrawalRules.penaltyFee = withdrawalRules.penaltyFee;
      }

      if (withdrawalRules.withdrawalFee !== undefined) {
        if (withdrawalRules.withdrawalFee < 0 || withdrawalRules.withdrawalFee > 10) {
          return res.status(400).json({ message: "Withdrawal fee must be between 0% and 10%" });
        }
        savingsPlan.withdrawalRules.withdrawalFee = withdrawalRules.withdrawalFee;
      }
    }

    await savingsPlan.save();

    res.json({
      success: true,
      message: "Fee structure updated successfully",
      data: {
        savingsPlanId: savingsPlan._id,
        feeSummary: savingsPlan.getFeeSummary()
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   GET FEE HISTORY
========================= */
router.get("/:id/fee-history", auth, async (req, res) => {
  try {
    const { limit = 20, page = 1, feeType } = req.query;
    const skip = (page - 1) * limit;

    const savingsPlan = await SavingsPlan.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!savingsPlan) {
      return res.status(404).json({ message: "Savings plan not found" });
    }

    // Build query for fee transactions
    const query = { 
      userId: req.user._id,
      transactionType: "fee_deduction"
    };

    if (feeType) {
      query["metadata.feeType"] = feeType;
    }

    const feeTransactions = await LedgerEntry.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await LedgerEntry.countDocuments(query);

    res.json({
      success: true,
      data: {
        transactions: feeTransactions.map(t => ({
          reference: t.reference,
          feeType: t.metadata.feeType,
          amount: t.debit,
          description: t.description,
          metadata: t.metadata,
          createdAt: t.createdAt
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
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   GET ALL USER FEES OVERVIEW
========================= */
router.get("/fees/overview", auth, async (req, res) => {
  try {
    const savingsPlans = await SavingsPlan.find({ userId: req.user._id });
    
    const totalFees = {
      management: 0,
      maintenance: 0,
      transaction: 0,
      penalty: 0
    };

    const feeDetails = [];

    for (const plan of savingsPlans) {
      const feeSummary = plan.getFeeSummary();
      
      // Add to totals
      totalFees.management += feeSummary.managementFee.currentAmount || 0;
      totalFees.maintenance += feeSummary.maintenanceFee.amount || 0;
      
      feeDetails.push({
        savingsPlanId: plan._id,
        savingsPlanName: plan.name,
        currentBalance: plan.currentAmount,
        feeSummary
      });
    }

    // Get actual fee deductions from ledger
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const actualFees = await LedgerEntry.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.user._id),
          transactionType: "fee_deduction",
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: "$metadata.feeType",
          totalAmount: { $sum: "$debit" },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalSavingsPlans: savingsPlans.length,
        projectedFees: totalFees,
        actualFeesLast30Days: actualFees.reduce((acc, fee) => {
          acc[fee._id] = {
            amount: fee.totalAmount,
            count: fee.count
          };
          return acc;
        }, {}),
        feeDetails,
        totalBalance: savingsPlans.reduce((sum, plan) => sum + plan.currentAmount, 0)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   APPLY DEFAULT FEE TEMPLATES
========================= */
router.post("/:id/apply-fee-template", auth, async (req, res) => {
  try {
    const { template } = req.body;

    const savingsPlan = await SavingsPlan.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!savingsPlan) {
      return res.status(404).json({ message: "Savings plan not found" });
    }

    const templates = {
      "fixed_savings": {
        fees: {
          managementFee: 1.0,
          managementFeeFrequency: "annually",
          transactionFees: {
            contribution: 0,
            withdrawal: 0,
            transfer: 0
          },
          maintenanceFee: 0,
          maintenanceFeeWaiver: 0
        },
        withdrawalRules: {
          penaltyFee: 10,
          withdrawalFee: 0,
          minWithdrawalAmount: 1000,
          maxWithdrawalsPerMonth: 0,
          requiresApproval: true
        }
      },
      "flexible_savings": {
        fees: {
          managementFee: 0.5,
          managementFeeFrequency: "annually",
          transactionFees: {
            contribution: 0,
            withdrawal: 0.5,
            transfer: 0.5
          },
          maintenanceFee: 100,
          maintenanceFeeWaiver: 10000
        },
        withdrawalRules: {
          penaltyFee: 0,
          withdrawalFee: 0.5,
          minWithdrawalAmount: 500,
          maxWithdrawalsPerMonth: 3,
          requiresApproval: false
        }
      },
      "target_savings": {
        fees: {
          managementFee: 0.8,
          managementFeeFrequency: "annually",
          transactionFees: {
            contribution: 0,
            withdrawal: 1,
            transfer: 0.5
          },
          maintenanceFee: 50,
          maintenanceFeeWaiver: 5000
        },
        withdrawalRules: {
          penaltyFee: 5,
          withdrawalFee: 1,
          minWithdrawalAmount: 1000,
          maxWithdrawalsPerMonth: 2,
          requiresApproval: false
        }
      }
    };

    if (!templates[template]) {
      return res.status(400).json({ 
        message: "Invalid template. Available: fixed_savings, flexible_savings, target_savings" 
      });
    }

    const templateData = templates[template];
    
    // Apply template
    savingsPlan.fees = { ...savingsPlan.fees, ...templateData.fees };
    savingsPlan.withdrawalRules = { ...savingsPlan.withdrawalRules, ...templateData.withdrawalRules };

    await savingsPlan.save();

    res.json({
      success: true,
      message: `Fee template '${template}' applied successfully`,
      data: {
        template,
        feeSummary: savingsPlan.getFeeSummary()
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
