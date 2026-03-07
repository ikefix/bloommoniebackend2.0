import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import User from "./models/user.js";

dotenv.config();
const MONGO_URI = process.env.MONGO_DB_CONN;
const SALT_ROUNDS = 10;

const seedAdmin = async () => {
    await mongoose.connect(MONGO_URI);

    const existing = await User.findOne({ role: "admin" });
    if (existing) {
        console.log("Admin already exists");
        return process.exit(0);
    }

    const hashedPassword = await bcrypt.hash("admin123", SALT_ROUNDS);

    const admin = new User({
        name: "Default Admin",
        email: "admin@bloom.com",
        password: hashedPassword,
        role: "admin",
    });

    await admin.save();
    console.log("✅ Default admin created");
    process.exit(0);
};

seedAdmin();