import { Router } from "express";
import User from "../models/user.js";
import Savings from "../models/savings.js";
import auth from "../middlewares/auth.js";

const router = Router();

// Helper function to get or create savings account
const getOrCreateSavings = async (userId) => {
  let savings = await Savings.findOne({ userId });
  if (!savings) {
    savings = new Savings({ userId });
    await savings.save();
  }
  return savings;
};

/* =========================
   GET WALLET BALANCE
========================= */
router.get("/balance", auth, async (req, res) => {
  try {
    const savings = await getOrCreateSavings(req.user._id);
    res.json({ 
      balance: savings.balance,
      lastUpdated: savings.lastUpdated,
      isActive: savings.isActive
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   ADD MONEY TO WALLET
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

    const savings = await getOrCreateSavings(req.user._id);
    
    // Update balance
    savings.balance += amount;
    
    // Add transaction
    await savings.addTransaction("deposit", amount, description);
    
    // Update user's wallet balance
    await User.findByIdAndUpdate(req.user._id, { 
      walletBalance: savings.balance 
    });

    res.json({ 
      message: "Money added successfully",
      newBalance: savings.balance,
      transaction: {
        type: "deposit",
        amount,
        description,
        balance: savings.balance,
        timestamp: new Date()
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   WITHDRAW MONEY FROM WALLET
========================= */
router.post("/withdraw", auth, async (req, res) => {
  try {
    const { amount, description } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }
    
    if (!description) {
      return res.status(400).json({ message: "Description is required" });
    }

    const savings = await getOrCreateSavings(req.user._id);
    
    if (savings.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    
    // Update balance
    savings.balance -= amount;
    
    // Add transaction
    await savings.addTransaction("withdrawal", amount, description);
    
    // Update user's wallet balance
    await User.findByIdAndUpdate(req.user._id, { 
      walletBalance: savings.balance 
    });

    res.json({ 
      message: "Money withdrawn successfully",
      newBalance: savings.balance,
      transaction: {
        type: "withdrawal",
        amount,
        description,
        balance: savings.balance,
        timestamp: new Date()
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
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

    // Get sender's savings account
    const senderSavings = await getOrCreateSavings(req.user._id);
    
    if (senderSavings.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Find recipient
    const recipient = await User.findOne({ phone: recipientPhone });
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    if (recipient._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot transfer to yourself" });
    }

    // Get recipient's savings account
    const recipientSavings = await getOrCreateSavings(recipient._id);

    // Update balances
    senderSavings.balance -= amount;
    recipientSavings.balance += amount;

    // Add transactions
    await senderSavings.addTransaction("transfer_out", amount, description, req.user._id, recipient._id);
    await recipientSavings.addTransaction("transfer_in", amount, description, req.user._id, recipient._id);

    // Update both users' wallet balances
    await User.findByIdAndUpdate(req.user._id, { 
      walletBalance: senderSavings.balance 
    });
    await User.findByIdAndUpdate(recipient._id, { 
      walletBalance: recipientSavings.balance 
    });

    res.json({ 
      message: "Transfer successful",
      senderBalance: senderSavings.balance,
      recipientName: recipient.name,
      transaction: {
        type: "transfer_out",
        amount,
        description,
        toUser: recipient.name,
        balance: senderSavings.balance,
        timestamp: new Date()
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   GET TRANSACTION HISTORY
========================= */
router.get("/transactions", auth, async (req, res) => {
  try {
    const { limit = 20, page = 1, type } = req.query;
    const skip = (page - 1) * limit;
    
    const savings = await getOrCreateSavings(req.user._id);
    
    let transactions = savings.transactions;
    
    // Filter by type if specified
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }
    
    // Sort by timestamp (newest first)
    transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Paginate
    const totalCount = transactions.length;
    const paginatedTransactions = transactions.slice(skip, skip + parseInt(limit));
    
    // Populate user details for transfers
    const populatedTransactions = await Promise.all(
      paginatedTransactions.map(async (transaction) => {
        const populated = { ...transaction.toObject() };
        
        if (transaction.fromUser) {
          const fromUser = await User.findById(transaction.fromUser).select('name email phone');
          populated.fromUserDetails = fromUser;
        }
        
        if (transaction.toUser) {
          const toUser = await User.findById(transaction.toUser).select('name email phone');
          populated.toUserDetails = toUser;
        }
        
        return populated;
      })
    );

    res.json({
      transactions: populatedTransactions,
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

/* =========================
   GET WALLET SUMMARY
========================= */
router.get("/summary", auth, async (req, res) => {
  try {
    const savings = await getOrCreateSavings(req.user._id);
    
    const totalDeposits = savings.transactions
      .filter(t => t.type === "deposit")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalWithdrawals = savings.transactions
      .filter(t => t.type === "withdrawal")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalTransfersOut = savings.transactions
      .filter(t => t.type === "transfer_out")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalTransfersIn = savings.transactions
      .filter(t => t.type === "transfer_in")
      .reduce((sum, t) => sum + t.amount, 0);

    res.json({
      balance: savings.balance,
      totalDeposits,
      totalWithdrawals,
      totalTransfersOut,
      totalTransfersIn,
      transactionCount: savings.transactions.length,
      lastUpdated: savings.lastUpdated,
      isActive: savings.isActive
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
