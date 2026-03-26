import express from "express";
import { config } from "dotenv";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import leadRoutes from "./routes/leadRoutes.js";
import importRoutes from "./routes/importRoutes.js";
config();

const app = express();
const PORT = 5000;

const allowedOrigins = ["https://inbest.netlify.app"];
// const allowedOrigins = ["http://localhost:5173"];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// app.use((req, res, next) => {
//   const start = Date.now();

//   console.log("----- Incoming Request -----");
//   console.log("Time       :", new Date().toISOString());
//   console.log("Method     :", req.method);
//   console.log("URL        :", req.originalUrl);
//   console.log("Query      :", req.query);
//   console.log("Body       :", req.body);

//   res.on("finish", () => {
//     const duration = Date.now() - start;
//     console.log("Status     :", res.statusCode);
//     console.log("Duration   :", `${duration} ms`);
//     console.log("-----------------------------\n");
//   });

//   next();
// });

app.use("/api/auth", authRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/imports", importRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: "success",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 API: http://localhost:${PORT}/api`);
  });
};

startServer();
