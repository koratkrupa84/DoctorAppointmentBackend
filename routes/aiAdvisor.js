const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

// Simple AI Advisor - Basic health advice based on keywords
// Made optional auth so anyone can use it
router.post("/advice", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    const userMessage = message.toLowerCase().trim();
    let advice = "";

    // Simple keyword-based advice system
    if (userMessage.includes("fever") || userMessage.includes("temperature")) {
      advice = "For fever, I recommend:\n• Rest and stay hydrated\n• Take paracetamol if needed\n• Monitor temperature regularly\n• If fever persists for more than 3 days or is above 103°F, consult a doctor immediately";
    } else if (userMessage.includes("headache") || userMessage.includes("head pain")) {
      advice = "For headaches:\n• Rest in a quiet, dark room\n• Stay hydrated\n• Apply a cold or warm compress\n• If severe or persistent, consult a doctor";
    } else if (userMessage.includes("cough") || userMessage.includes("cold")) {
      advice = "For cough and cold:\n• Drink plenty of fluids\n• Get adequate rest\n• Use a humidifier\n• Gargle with warm salt water\n• If symptoms persist beyond a week, see a doctor";
    } else if (userMessage.includes("stomach") || userMessage.includes("stomachache") || userMessage.includes("nausea")) {
      advice = "For stomach issues:\n• Stay hydrated with clear fluids\n• Avoid spicy and heavy foods\n• Eat small, frequent meals\n• If severe pain or persistent vomiting, seek medical attention";
    } else if (userMessage.includes("pain") || userMessage.includes("ache")) {
      advice = "For general pain:\n• Rest the affected area\n• Apply ice or heat as appropriate\n• Over-the-counter pain relievers may help\n• If pain is severe or persistent, consult a healthcare professional";
    } else if (userMessage.includes("sleep") || userMessage.includes("insomnia")) {
      advice = "For sleep issues:\n• Maintain a regular sleep schedule\n• Avoid screens before bedtime\n• Create a comfortable sleep environment\n• Limit caffeine and alcohol\n• If sleep problems persist, consult a doctor";
    } else if (userMessage.includes("stress") || userMessage.includes("anxiety")) {
      advice = "For stress and anxiety:\n• Practice deep breathing exercises\n• Engage in regular physical activity\n• Get adequate sleep\n• Consider meditation or yoga\n• If symptoms are severe, seek professional help";
    } else if (userMessage.includes("diet") || userMessage.includes("nutrition") || userMessage.includes("food")) {
      advice = "For diet and nutrition:\n• Eat a balanced diet with fruits and vegetables\n• Stay hydrated\n• Limit processed foods\n• Eat regular meals\n• Consult a nutritionist for personalized advice";
    } else if (userMessage.includes("exercise") || userMessage.includes("fitness")) {
      advice = "For exercise and fitness:\n• Start slowly and gradually increase intensity\n• Stay hydrated during exercise\n• Warm up before and cool down after\n• Listen to your body\n• Consult a doctor before starting a new exercise routine if you have health concerns";
    } else if (userMessage.includes("skin") || userMessage.includes("rash")) {
      advice = "For skin issues:\n• Keep the area clean and dry\n• Avoid scratching\n• Use mild, fragrance-free products\n• If rash is severe, spreading, or accompanied by fever, see a dermatologist";
    } else {
      // General advice for unrecognized queries
      advice = "Thank you for your question. For personalized medical advice, I recommend:\n• Consulting with a qualified healthcare professional\n• Describing your symptoms in detail\n• Mentioning any medications you're taking\n• Seeking immediate medical attention for emergencies\n\nFor general health:\n• Maintain a balanced diet\n• Get regular exercise\n• Stay hydrated\n• Get adequate sleep\n• Manage stress effectively";
    }

    res.json({
      advice: advice,
      message: "AI advice generated successfully"
    });
  } catch (error) {
    console.error("AI advisor error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
