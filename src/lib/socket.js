const Message = require("../models/message");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Connected:", socket.id);

    socket.on("join room", (roomId) => {
      socket.join(roomId);
      console.log(`➡️ Joined room: ${roomId}`);
    });

    socket.on("leave room", (roomId) => {
      socket.leave(roomId);
      console.log(`⬅️ Left room: ${roomId}`);
    });

    socket.on("chat message", async ({ roomId, message }) => {
      try {
        const newMessage = new Message({
          sender: message.sender,
          receiver: message.receiver || null,
          group: message.group || null,
          content: message.content,
          timestamp: message.timestamp
            ? new Date(message.timestamp)
            : new Date(),
        });

        await newMessage.save();

        // 👉 Populate sender & receiver
        const populatedMessage = await Message.findById(newMessage._id)
          .populate("sender", "_id photoUrl")
          .populate("receiver", "_id photoUrl");

        // 🔁 Broadcast enriched message
        io.to(roomId).emit("chat message", populatedMessage);

        console.log(`📨 Message saved & broadcasted in ${roomId}`);
      } catch (err) {
        console.error("❌ Message save error:", err.message);
      }
    });

    socket.on("typing", ({ roomId, user }) => {
      socket.to(roomId).emit("typing", { user });
    });

    socket.on("disconnect", () => {
      console.log("🔴 Disconnected:", socket.id);
    });
  });
};
