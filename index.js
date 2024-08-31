import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./db/connect.js";
import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import { Server } from "socket.io";

// Load environment variables from .env file
dotenv.config();

const app = express();


// CORS configuration
const corsOptions = {
  origin: "https://cloni-frontend-aomp5iuhj-akashs-projects-6f1d4f45.vercel.app", // Replace with your frontend URL
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

// Apply CORS middleware
app.use(cors(corsOptions));

app.use(express.json());

const PORT = process.env.PORT || 5000;

let server;

// Connect to the database and start the server
connectDB()
  .then(() => {
    server = app.listen(PORT, () => {
      console.log(`Server is running at port ${PORT}`);
    });

    // Initialize Socket.IO and attach it to the Express server
    const io = new Server(server, {
      pingTimeout: 60000,
      cors: corsOptions, // Use the same CORS options here
    });

    // Socket.IO connection event
    io.on("connection", (socket) => {
      console.log("Connected to socket.io", socket.id);

      socket.on("setup", (userData) => {
        socket.join(userData.existingUser._id);
        socket.emit("connected");
      });

      socket.on("join chat", (room) => {
        socket.join(room);
        console.log("User joined room: " + room);
      });

      socket.on("typing", (room) => socket.in(room).emit("typing"));
      socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

      socket.on("new message", (newMessageReceived) => {
        let chat = newMessageReceived.chat;

        if (!chat.users) {
          return console.log("chat.users not defined");
        }

        chat.users.forEach((user) => {
          if (user._id === newMessageReceived.sender._id) return;
          socket.in(user._id).emit("message received", newMessageReceived);
        });
      });

      socket.on("disconnect", () => {
        console.log("User disconnected", socket.id);
      });

      socket.on("error", (err) => {
        console.error("Socket error:", err.message);
      });
    });

  })
  .catch((error) => {
    console.error("Could not connect to MongoDB", error);
  });

// Simple route to check if API is running
app.get("/", async (req, res) => {
  try {
    console.log("API is running successfully");
    return res.status(200).json({ message: "API is running successfully" });
  } catch (error) {
    console.log("API run failure", error);
    return res.status(500).json({ message: error.message });
  }
});

// Define your routes
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);


