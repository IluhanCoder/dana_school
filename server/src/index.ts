import "dotenv/config";
import express, { Express, Request, Response } from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "./auth/auth-router";
import userRouter from "./user/user-router";
import subjectRouter from "./subject/subject-router";
import gradeRouter from "./grade/grade-router";
import attendanceRouter from "./attendance/attendance-router";
import generationRouter from "./generation/generation-router";
import { GradeService } from "./grade/grade-service";

const app: Express = express();
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/school_app";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const EXTRA_ORIGIN = "http://localhost:5174";

// Middleware
app.use(
  cors({
    origin: [CLIENT_URL, EXTRA_ORIGIN],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'authorization'],
    exposedHeaders: ['Set-Cookie'],
  })
);
app.use(express.json());
app.use(cookieParser());

// MongoDB Connection
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("✓ MongoDB connected successfully");
    // Ensure all grades 0-8 exist
    await GradeService.ensureGradesExist();
  })
  .catch((error) => {
    console.error("✗ MongoDB connection error:", error);
  });

// Routes
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Server is running" });
});

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/subjects", subjectRouter);
app.use("/api/grades", gradeRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/generation", generationRouter);

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server is running on http://localhost:${PORT}`);
});
