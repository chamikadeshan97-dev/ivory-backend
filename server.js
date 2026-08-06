import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import "dotenv/config";
import apiRoutes from "./routes/index.js";
import { ensureDatabase } from "./utils/excelDb.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());

ensureDatabase();

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Dental Clinic Backend API",
  });
});

app.use("/api", apiRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
