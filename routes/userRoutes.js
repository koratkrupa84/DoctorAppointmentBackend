const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Admin = require("../models/Admin");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const auth = require("../middleware/auth");
const Appointment = require("../models/Appointment");
const Feedback = require("../models/Feedback");
const LabTest = require("../models/LabTest");
const LabTestBooking = require("../models/LabTestBooking");
const Consultation = require("../models/Consultation");
const ConsultationMessage = require("../models/ConsultationMessage");
const Doctor = require("../models/Doctor");

// Register route
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, gender, phone, address, dob, role } = req.body;

    // Email already exist check
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "❌ Email already registered" });
    }

    // User create
    const user = new User({
      name,
      email,
      password, // bcrypt hook handle karega
      gender,
      phone,
      address,
      dob,
      role,
    });

    await user.save();

    //user object bhi bhejna hai
    res.status(201).json({
      message: "✅ User registered successfully",
      user: user
    });

  } catch (error) {
    console.error("❌ Register error:", error);
    res.status(500).json({ message: "Server error" });
  }   
});

// Login route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find User
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "❌ User not found" });
    }

    // Check the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "❌ Invalid password" });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secretKey",
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "❌ Server error" });
  }
});

// ===== FORGOT Password (set new password by email) =====
router.post("/forgot-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found with this email" });
    }

    // Set new password and let pre-save hook hash it
    user.password = newPassword;
    await user.save();

    return res.json({ message: "Password updated successfully. Please login with your new password." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== GET Patient Dashboard =====
router.get("/dashboard", auth, async (req, res) => {
  try {
    // Check if user is a patient
    if (req.userRole !== "Patient") {
      return res.status(403).json({ message: "Only patients can access this endpoint" });
    }

    // Get user details
    const user = await User.findById(req.userId).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get patient statistics
    let totalVisits = 0;
    let upcomingAppointments = 0;
    let totalBills = 0;
    let recentAppointments = [];

    if (Appointment) {
      // Get all appointments for this patient to see what statuses exist
      const allAppointments = await Appointment.find({ user_id: req.userId }).lean();
      // console.log("Patient appointments statuses:", allAppointments.map(a => a.status));

      // Total completed appointments (visits) - using more realistic statuses
      totalVisits = await Appointment.countDocuments({
        user_id: req.userId,
        status: { $in: ["Completed", "Done", "Approved", "Finished", "Attended"] }
      });

      // Upcoming appointments - using more realistic statuses
      upcomingAppointments = await Appointment.countDocuments({
        user_id: req.userId,
        date: { $gte: new Date() },
        status: { $in: ["Pending", "Confirmed", "Scheduled", "Booked"] }
      });

      // Calculate total bills (all appointments * doctor fees for now)
      const allAppointmentsWithFees = await Appointment.find({
        user_id: req.userId
      }).populate('doctor_id', 'fees').lean();

      totalBills = allAppointmentsWithFees.reduce((total, appt) => {
        return total + (appt.doctor_id?.fees || 0);
      }, 0);

      // If no appointments found, set default values for testing
      if (allAppointmentsWithFees.length === 0) {
        totalVisits = 0;
        upcomingAppointments = 0;
        totalBills = 0;
      }

      // Get recent appointments
      recentAppointments = await Appointment.find({
        user_id: req.userId
      })
        .populate('doctor_id', 'specialization fees')
        .sort({ date: -1 })
        .limit(5)
        .lean();
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      },
      stats: {
        totalVisits,
        upcomingAppointments,
        totalBills
      },
      recentAppointments: recentAppointments.map(appt => ({
        id: appt._id,
        date: new Date(appt.date).toISOString().split('T')[0],
        time: appt.time,
        status: appt.status,
        specialization: appt.doctor_id?.specialization || "Unknown",
        fees: appt.doctor_id?.fees || 0
      }))
    });
  } catch (error) {
    console.error("Patient dashboard error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== GET Patient Appointments =====
router.get("/appointments", auth, async (req, res) => {
  try {
    // Check if user is a patient
    if (req.userRole !== "Patient") {
      return res.status(403).json({ message: "Only patients can access this endpoint" });
    }

    let appointments = [];
    if (Appointment) {
      appointments = await Appointment.find({ user_id: req.userId })
        .populate('doctor_id', 'specialization fees')
        .sort({ date: 1, time: 1 })
        .lean();
    }

    // Format appointments for frontend
    const formattedAppointments = appointments.map(appt => ({
      id: appt._id,
      date: new Date(appt.date).toISOString().split('T')[0],
      time: appt.time,
      status: appt.status,
      symptoms: appt.symptoms,
      notes: appt.notes,
      specialization: appt.doctor_id?.specialization || "Unknown",
      fees: appt.doctor_id?.fees || 0,
      createdAt: appt.createdAt
    }));

    res.json({
      appointments: formattedAppointments,
      total: formattedAppointments.length
    });
  } catch (error) {
    console.error("Patient appointments error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== GET Patient Profile =====
router.get("/profile", auth, async (req, res) => {
  try {
    // Check if user is a patient
    if (req.userRole !== "Patient") {
      return res.status(403).json({ message: "Only patients can access this endpoint" });
    }

    const user = await User.findById(req.userId).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : user.dob,
        gender: user.gender,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Patient profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== UPDATE Patient Profile =====
router.put("/profile", auth, async (req, res) => {
  try {
    // Check if user is a patient
    if (req.userRole !== "Patient") {
      return res.status(403).json({ message: "Only patients can access this endpoint" });
    }

    const { name, phone, address, dob, gender } = req.body;

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { name, phone, address, dob, gender },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        address: updatedUser.address,
        dob: updatedUser.dob ? new Date(updatedUser.dob).toISOString().split('T')[0] : updatedUser.dob,
        gender: updatedUser.gender,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error("Patient profile update error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== SUBMIT Feedback (User) =====
router.post("/feedback", auth, async (req, res) => {
  try {
    // Check if user is a patient
    if (req.userRole !== "Patient") {
      return res.status(403).json({ message: "Only patients can submit feedback" });
    }

    const { subject, message, rating } = req.body;

    // Validate required fields
    if (!subject || !message) {
      return res.status(400).json({ message: "Subject and message are required" });
    }

    // Validate rating if provided
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    // Create new feedback
    const feedback = new Feedback({
      user_id: req.userId,
      subject,
      message,
      rating: rating || 5,
      status: "Pending"
    });

    await feedback.save();

    // Populate user data for response
    const populatedFeedback = await Feedback.findById(feedback._id)
      .populate('user_id', 'name email')
      .lean();

    res.status(201).json({
      message: "Feedback submitted successfully",
      feedback: {
        id: populatedFeedback._id,
        subject: populatedFeedback.subject,
        message: populatedFeedback.message,
        rating: populatedFeedback.rating,
        status: populatedFeedback.status,
        createdAt: populatedFeedback.createdAt
      }
    });
  } catch (error) {
    console.error("Submit feedback error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== GET User's Feedback (User) =====
router.get("/feedback", auth, async (req, res) => {
  try {
    // Check if user is a patient
    if (req.userRole !== "Patient") {
      return res.status(403).json({ message: "Only patients can access this endpoint" });
    }

    const feedbacks = await Feedback.find({ user_id: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    const formattedFeedbacks = feedbacks.map(feedback => ({
      id: feedback._id,
      subject: feedback.subject,
      message: feedback.message,
      rating: feedback.rating,
      status: feedback.status,
      admin_response: feedback.admin_response || "",
      responded_at: feedback.responded_at || null,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt
    }));

    res.json({
      feedbacks: formattedFeedbacks,
      total: formattedFeedbacks.length
    });
  } catch (error) {
    console.error("Get user feedback error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== GET All Lab Tests (Public) =====
router.get("/lab-tests", async (req, res) => {
  try {
    const labTests = await LabTest.find().lean();
    
    const formattedTests = labTests.map(test => ({
      id: test._id,
      test_name: test.test_name,
      description: test.description || "",
      price: test.price
    }));

    res.json({
      labTests: formattedTests,
      total: formattedTests.length
    });
  } catch (error) {
    console.error("Get lab tests error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== POST Book Lab Test =====
router.post("/book-lab-test", auth, async (req, res) => {
  try {
    // Check if user is a patient
    if (req.userRole !== "Patient") {
      return res.status(403).json({ message: "Only patients can book lab tests" });
    }

    const { test_id, date, time, notes } = req.body;

    if (!test_id || !date || !time) {
      return res.status(400).json({ message: "Test ID, date, and time are required" });
    }

    // Check if test exists
    const test = await LabTest.findById(test_id);
    if (!test) {
      return res.status(404).json({ message: "Lab test not found" });
    }

    // Create new lab test booking
    const booking = new LabTestBooking({
      user_id: req.userId,
      test_id,
      date,
      time,
      notes: notes || "",
      status: "Pending"
    });

    await booking.save();

    res.status(201).json({
      message: "Lab test booked successfully",
      booking: {
        id: booking._id,
        test_id: booking.test_id,
        date: booking.date,
        time: booking.time,
        status: booking.status
      }
    });
  } catch (error) {
    console.error("Error booking lab test:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== GET Patient Lab Test Bookings =====
router.get("/lab-test-bookings", auth, async (req, res) => {
  try {
    // Check if user is a patient
    if (req.userRole !== "Patient") {
      return res.status(403).json({ message: "Only patients can access this endpoint" });
    }

    const bookings = await LabTestBooking.find({ user_id: req.userId })
      .populate('test_id', 'test_name description price')
      .sort({ date: 1, time: 1 })
      .lean();

    // Format bookings for frontend
    const formattedBookings = bookings.map(booking => ({
      id: booking._id,
      date: new Date(booking.date).toISOString().split('T')[0],
      time: booking.time,
      status: booking.status,
      notes: booking.notes,
      test_name: booking.test_id?.test_name || "Unknown",
      description: booking.test_id?.description || "",
      price: booking.test_id?.price || 0,
      createdAt: booking.createdAt
    }));

    res.json({
      bookings: formattedBookings,
      total: formattedBookings.length
    });
  } catch (error) {
    console.error("Patient lab test bookings error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== GET All Doctors for Consultation (Patient) =====
router.get("/consultation/doctors", auth, async (req, res) => {
  try {
    // Check if user is a patient
    if (req.userRole !== "Patient") {
      return res.status(403).json({ message: "Only patients can access this endpoint" });
    }

    const doctors = await Doctor.find()
      .populate('userId', 'name email')
      .select('specialization qualification experience fees')
      .lean();

    const formattedDoctors = doctors.map(doctor => ({
      id: doctor._id,
      name: doctor.userId?.name || "Unknown",
      email: doctor.userId?.email || "",
      specialization: doctor.specialization || "",
      qualification: doctor.qualification || "",
      experience: doctor.experience || 0,
      fees: doctor.fees || 0
    }));

    res.json({
      doctors: formattedDoctors,
      total: formattedDoctors.length
    });
  } catch (error) {
    console.error("Get consultation doctors error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== CREATE Consultation (Patient) =====
router.post("/consultation", auth, async (req, res) => {
  try {
    // Check if user is a patient
    if (req.userRole !== "Patient") {
      return res.status(403).json({ message: "Only patients can create consultations" });
    }

    const { doctor_id, subject } = req.body;

    if (!doctor_id) {
      return res.status(400).json({ message: "Doctor ID is required" });
    }

    // Check if doctor exists
    const doctor = await Doctor.findById(doctor_id);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Check if active consultation already exists
    const existingConsultation = await Consultation.findOne({
      patient_id: req.userId,
      doctor_id: doctor_id,
      status: 'Active'
    });

    if (existingConsultation) {
      return res.status(400).json({ 
        message: "Active consultation already exists with this doctor",
        consultation_id: existingConsultation._id
      });
    }

    // Create new consultation
    const consultation = new Consultation({
      patient_id: req.userId,
      doctor_id: doctor_id,
      subject: subject || "",
      status: 'Active'
    });

    await consultation.save();

    res.status(201).json({
      message: "Consultation created successfully",
      consultation: {
        id: consultation._id,
        doctor_id: consultation.doctor_id,
        status: consultation.status
      }
    });
  } catch (error) {
    console.error("Error creating consultation:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== GET Patient Consultations =====
router.get("/consultations", auth, async (req, res) => {
  try {
    // Check if user is a patient
    if (req.userRole !== "Patient") {
      return res.status(403).json({ message: "Only patients can access this endpoint" });
    }

    const consultations = await Consultation.find({ patient_id: req.userId })
      .populate({
        path: 'doctor_id',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      })
      .sort({ updatedAt: -1 })
      .lean();

    const formattedConsultations = consultations.map(consultation => ({
      id: consultation._id,
      doctor_name: consultation.doctor_id?.userId?.name || "Unknown",
      doctor_email: consultation.doctor_id?.userId?.email || "",
      specialization: consultation.doctor_id?.specialization || "",
      status: consultation.status,
      subject: consultation.subject || "",
      createdAt: consultation.createdAt,
      updatedAt: consultation.updatedAt
    }));

    res.json({
      consultations: formattedConsultations,
      total: formattedConsultations.length
    });
  } catch (error) {
    console.error("Get patient consultations error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== SEND Message in Consultation (Patient) =====
router.post("/consultation/:consultationId/message", auth, async (req, res) => {
  try {
    // Check if user is a patient
    if (req.userRole !== "Patient") {
      return res.status(403).json({ message: "Only patients can send messages" });
    }

    const { consultationId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    // Check if consultation exists and belongs to patient
    const consultation = await Consultation.findById(consultationId);
    if (!consultation) {
      return res.status(404).json({ message: "Consultation not found" });
    }

    if (consultation.patient_id.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Unauthorized access to this consultation" });
    }

    // Create message
    const consultationMessage = new ConsultationMessage({
      consultation_id: consultationId,
      sender_id: req.userId,
      sender_role: 'Patient',
      message: message.trim()
    });

    await consultationMessage.save();

    // Update consultation updatedAt
    await Consultation.findByIdAndUpdate(consultationId, { updatedAt: new Date() });

    res.status(201).json({
      message: "Message sent successfully",
      messageData: {
        id: consultationMessage._id,
        message: consultationMessage.message,
        sender_role: consultationMessage.sender_role,
        createdAt: consultationMessage.createdAt
      }
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== GET Messages for Consultation (Patient) =====
router.get("/consultation/:consultationId/messages", auth, async (req, res) => {
  try {
    // Check if user is a patient
    if (req.userRole !== "Patient") {
      return res.status(403).json({ message: "Only patients can access this endpoint" });
    }

    const { consultationId } = req.params;

    // Check if consultation exists and belongs to patient
    const consultation = await Consultation.findById(consultationId);
    if (!consultation) {
      return res.status(404).json({ message: "Consultation not found" });
    }

    if (consultation.patient_id.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Unauthorized access to this consultation" });
    }

    // Get all messages for this consultation
    const messages = await ConsultationMessage.find({ consultation_id: consultationId })
      .populate('sender_id', 'name')
      .sort({ createdAt: 1 })
      .lean();

    const formattedMessages = messages.map(msg => ({
      id: msg._id,
      message: msg.message,
      sender_role: msg.sender_role,
      sender_name: msg.sender_id?.name || "Unknown",
      createdAt: msg.createdAt,
      read: msg.read
    }));

    res.json({
      messages: formattedMessages,
      total: formattedMessages.length
    });
  } catch (error) {
    console.error("Get consultation messages error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
