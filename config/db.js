import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGOURI;

    await mongoose.connect(MONGODB_URI);
    console.log("✅ Database connected successfully");
    return true;
  } catch (error) {
    console.log("❌ Database connection failed:", error.message);
    process.exit(1);
  }
};

export const getConnectionStatus = () => {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return {
    isConnected: mongoose.connection.readyState === 1,
    state: states[mongoose.connection.readyState] || "unknown",
  };
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log("🔌 Database disconnected");
  } catch (error) {
    console.error("Error disconnecting:", error.message);
  }
};
