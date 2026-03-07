
import express from "express";
import mongoose from "mongoose";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cors from "cors";
import dns from "dns";       //Remove this during production
import dotenv from "dotenv";


import userRoutes from "./route/auth.js";
dotenv.config();




dns.setServers(["1.1.1.1", "8.8.8.8"]);  //Remove this during production, it's just to ensure that DNS resolution works correctly in development environments where there might be issues with the default DNS servers.



const app = express();



const MONGODB_CONNECTION_STRING = process.env.MONGO_DB_CONN;
const PORT = process.env.PORT || 5000;

/* Middleware */
app.use(morgan("tiny"));
app.use(express.json());
// Enable CORS for frontend (set FRONTEND_ORIGIN in .env for production)
app.use(cors({
  origin: "http://localhost:5173", // Vite default port
  credentials: true
}));


/* Rate Limiter */
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
});

app.use(limiter);

app.use("/api/users", userRoutes);

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
