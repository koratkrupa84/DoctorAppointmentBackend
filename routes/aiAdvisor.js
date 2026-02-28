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

    // Enhanced keyword-based advice system with professional medical responses
    if (userMessage.includes("fever") || userMessage.includes("temperature")) {
      severity = userMessage.includes("high") || userMessage.includes("103") ? "high" : 
                  userMessage.includes("102") || userMessage.includes("101.5") ? "moderate" : "low";
      
      advice = `🔥 **Professional Fever Management Guide**

**📊 Current Assessment:** ${severity} fever detected

**🏥 Immediate Medical Actions:**
• **Temperature Monitoring:** Check every 2-3 hours and record readings
• **Hydration Protocol:** Drink 8-10 glasses of water daily + electrolyte solutions
• **Environmental Control:** Keep room temperature between 68-72°F (20-22°C)
• **Clothing:** Wear lightweight, breathable cotton fabrics
• **Rest:** Complete bed rest until fever breaks for 24 hours

**💊 Evidence-Based Medication Guidelines:**
• **Low-Grade Fever (<100.4°F / 38°C):** No medication needed, monitor only
• **Moderate Fever (100.4-102.2°F / 38-39°C):** Acetaminophen 500-1000mg every 6 hours
• **High Fever (102.3-103.9°F / 39-39.9°C):** Acetaminophen + cold compresses
• **Very High Fever (>104°F / 40°C):** Seek immediate emergency care

**⚠️ Emergency Warning Signs - Seek Immediate Care:**
• Temperature > 104°F (40°C) that doesn't respond to medication
• Fever lasting > 72 hours in adults, > 48 hours in children
• Stiff neck, severe headache, or sensitivity to light
• Difficulty breathing or chest pain
• Confusion, disorientation, or extreme irritability
• Seizures or loss of consciousness
• Rash that doesn't fade when pressed (glass test)

**🔬 Advanced Home Care Techniques:**
• **Sponge Bath:** Use lukewarm water (not cold) for high fevers
• **Hydration Monitoring:** Check urine color - should be pale yellow
• **Nutrition:** Light, easily digestible foods (BRAT diet)
• **Sleep:** Elevate head with extra pillows for comfort
• **Air Circulation:** Use fan on low setting, avoid direct drafts

**📈 Recovery Timeline:**
• **Day 1-2:** Active fever phase, intensive monitoring
• **Day 3-4:** Fever should start subsiding with proper care
• **Day 5+:** If fever persists, medical evaluation required

**🩺 Professional Medical Consultation Indicators:**
• Fever with chronic medical conditions (diabetes, heart disease)
• Fever after recent surgery or medical procedure
• Fever in elderly (>65 years) or immunocompromised patients
• Fever with recent international travel

**Recommendations:**
• Monitor temperature every 2-3 hours
• Maintain proper hydration with electrolytes
• Use appropriate fever medication as needed
• Seek emergency care for high fever or warning signs
• Follow up with doctor if fever persists beyond 3 days

**Disclaimer:**
⚠️ **Professional Medical Disclaimer**: This information is for educational purposes only. Always consult with a qualified healthcare professional for proper diagnosis and treatment. In case of emergency, call emergency services immediately.`;
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
