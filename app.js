
import express from "express";
import mongoose from "mongoose";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cors from "cors";
import dns from "dns";       //Remove this during production
import dotenv from "dotenv";

import userRoutes from "./route/auth.js";
import walletRoutes from "./route/wallet.js";
import paymentRoutes from "./route/payment.js";
import virtualAccountRoutes from "./route/virtualAccount.js";
import savingsPlanRoutes from "./route/savingsPlan.js";
import savingsFeesRoutes from "./route/savingsFees.js";
import inventoryRoutes from "./route/inventory.js";
import posRoutes from "./route/pos.js";
import supplierRoutes from "./route/supplier.js";
import purchaseRoutes from "./route/purchase.js";
import invoiceRoutes from "./route/invoice.js";
import salesRoutes from "./route/sales.js";
import expenseRoutes from "./route/expense.js";
import staffRoutes from "./route/staff.js";
import reportsRoutes from "./route/reports.js";
import shopRoutes from "./route/shop.js";
import shopVerificationRoutes from "./route/shopVerification.js";
import shopInvitationRoutes from "./route/shopInvitation.js";
dotenv.config();


dns.setServers(["1.1.1.1", "8.8.8.8"]);  //Remove this during production, it's just to ensure that DNS resolution works correctly in development environments where there might be issues with the default DNS servers.



const app = express();



const MONGODB_CONNECTION_STRING = process.env.MONGO_DB_CONN; // Remove the slash
const PORT = process.env.PORT || 5000;

/* Middleware */
app.use(morgan("tiny"));
app.use(express.json());
// Enable CORS for frontend (set FRONTEND_ORIGIN in .env for production)
app.use(cors({
  origin: ["http://localhost:5173", "https://arcelia-unthievish-duplicitously.ngrok-free.dev", 'https://untranquil-anastacia-noncosmically.ngrok-free.dev'],
  credentials: true
}));


/* Rate Limiter */
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
});

app.use(limiter);

const acs = process.env.APIC;

app.use(`/${acs}/users`, userRoutes);
app.use(`/${acs}/wallet`, walletRoutes);
app.use(`/${acs}/payment`, paymentRoutes);
app.use(`/${acs}/virtual-account`, virtualAccountRoutes);
app.use(`/${acs}/savings`, savingsPlanRoutes);
app.use(`/${acs}/savings-fees`, savingsFeesRoutes);
app.use(`/${acs}/inventory`, inventoryRoutes);
app.use(`/${acs}/pos`, posRoutes);
app.use(`/${acs}/suppliers`, supplierRoutes);
app.use(`/${acs}/purchases`, purchaseRoutes);
app.use(`/${acs}/invoices`, invoiceRoutes);
app.use(`/${acs}/sales`, salesRoutes);
app.use(`/${acs}/expenses`, expenseRoutes);
app.use(`/${acs}/staff`, staffRoutes);
app.use(`/${acs}/reports`, reportsRoutes);
app.use(`/${acs}/shops`, shopRoutes);
app.use(`/api/shop-verification-page`, shopVerificationRoutes);
app.use(`/api/shop-invitation`, shopInvitationRoutes);

app.use('/', (_, res) => {
  res.json({ message: 'Welcome to Bloomrest API', version: '1.0.0' });
});

/* Database Connection with Retry Logic */
// +++++++++++++++ MongoDB connection +++++++++++++++
const mongoOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  family: 4,
  retryWrites: true,
  w: 'majority',
  maxPoolSize: 10,
};

const connectWithRetry = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(MONGODB_CONNECTION_STRING, mongoOptions);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  }
};

mongoose.connection.on('error', (err) => console.error('MongoDB connection error:', err));
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
  connectWithRetry();
});

connectWithRetry();

/* Start Server */


app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
