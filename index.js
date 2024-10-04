// 

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./db/connect.js";
import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import { Server } from "socket.io";

dotenv.config();

const app = express();

const corsOptions = {
  origin: ["https://cloni-frontend.vercel.app", "http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

app.get("/", async (req, res) => {
  try {
    console.log("API is running successfully");
    return res.status(200).json({ message: "API is running successfully" });
  } catch (error) {
    console.log("API run failure", error);
    return res.status(500).json({ message: error.message });
  }
});

// Function to initialize Socket.IO
const initializeSocket = (server) => {
  const io = new Server(server, {
    pingTimeout: 60000,
    transports: ["websocket", "polling"],
    cors: corsOptions,
  });

  io.on("connection", (socket) => {
    console.log("Connected to socket.io", socket.id);

    socket.on("setup", (userData) => {
      console.log(userData);
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
      let chat = newMessageReceived.newMessage.chat;

      if (!chat.users) {
        return console.log("chat.users not defined");
      }

      chat?.users?.forEach((user) => {
        if (user?._id === newMessageReceived?.newMessage?.sender?._id) return;
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

  return io; // Return the io instance if needed elsewhere
};

connectDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Server is running at port ${PORT}`);
    });

    const io = initializeSocket(server); // Initialize socket with the server

    // Attach the io instance to the req object
    app.use((req, res, next) => {
      req.io = io; // Attach the io instance to the request object
      next();
    });
  })
  .catch((error) => {
    console.error("Could not connect to MongoDB", error);
  });
