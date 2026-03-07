import { Router } from "express";
import bcrypt from "bcrypt";
import User from "../models/user.js";
import { authenticateToken, authorizeRoles } from "../middlewares/auth.js";

const router = Router();
const SALT_ROUNDS = 10;

// Admin creates Cashier or Manager
router.post("/create-user", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!["cashier", "manager"].includes(role)) {
      return res.status(400).json({ message: "Role must be cashier or manager" });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role
    });

    await newUser.save();
    res.status(201).json({ message: `${role} created successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;