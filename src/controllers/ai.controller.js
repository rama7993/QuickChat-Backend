const { generateText } = require("ai");
const { google } = require("@ai-sdk/google");
const Message = require("../models/message");

exports.getSmartReplies = async (req, res) => {
  const { conversationId } = req.params;
  const { type } = req.query;
  const currentUserId = req.user.id;

  try {
    let query =
      type === "group"
        ? { group: conversationId }
        : {
            $or: [
              { sender: currentUserId, receiver: conversationId },
              { sender: conversationId, receiver: currentUserId },
            ],
          };

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(10)
      .populate("sender", "username")
      .lean();

    if (!messages?.length) {
      return res.json({ replies: ["Hey!", "How are you?", "Hello!"] });
    }

    const lastMessages = messages
      .reverse()
      .map((m) => {
        const isMe = m.sender._id.toString() === currentUserId.toString();
        return `${isMe ? "Me" : m.sender.username}: ${m.content || "[Media]"}`;
      })
      .join("\n");

    const prompt = `Based on this chat, suggest 3 short, natural quick replies (<5 words each). Return ONLY a JSON array.
    Chat:
    ${lastMessages}`;

    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
    });

    const jsonMatch = text.match(/\[.*\]/s);
    const replies = jsonMatch ? JSON.parse(jsonMatch[0]) : ["OK", "Got it"];

    res.json({ replies });
  } catch (error) {
    res.json({ replies: ["Got it", "Sounds good"] });
  }
};
