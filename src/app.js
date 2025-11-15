import express from "express";
import cors from "cors";
import morgan from "morgan";

// Routes
// import doctorRoutes from "./routes/doctor.routes.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// API Routes
// app.use("/api/doctors", doctorRoutes);

// Health check route
app.get("/", (req, res) => {
  res.send("Doctor Appointment Backend Running ✔️");
});

export default app;
