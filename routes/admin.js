const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const Admin = require("../models/Admin");
const Feedback = require("../models/Feedback");
const auth = require("../middleware/auth");

// ===== TEST ROUTE =====
router.get("/test", (req, res) => {
  res.json({ message: "Admin routes are working!" });
});

// ===== DEBUG ROUTE - Check Database Structure =====
router.get("/debug-appointments", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    // Get raw appointments without populate
    const rawAppointments = await Appointment.find().limit(3).lean();
    
    // Get appointments with basic populate
    const basicPopulated = await Appointment.find().limit(3)
      .populate('user_id', 'name email phone')
      .populate('doctor_id')
      .lean();
    
    // Get appointments with nested populate
    const nestedPopulated = await Appointment.find().limit(3)
      .populate('user_id', 'name email phone')
      .populate({
        path: 'doctor_id',
        populate: {
          path: 'userId',
          select: 'name email phone'
        }
      })
      .lean();

    res.json({
      rawAppointments,
      basicPopulated,
      nestedPopulated,
      message: "Debug data retrieved"
    });
  } catch (error) {
    console.error("Debug appointments error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ===== GET All Appointments (Admin) =====
router.get("/appointments", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    // First, update expired appointments to 'Expired' status
    const currentDate = new Date();
    await Appointment.updateMany(
      { 
        date: { $lt: currentDate },
        status: { $nin: ['Completed', 'Cancelled', 'Expired'] }
      },
      { status: 'Expired' }
    );

    // Get all appointments including expired ones
    const appointments = await Appointment.find({})
      .populate('user_id', 'name email phone')
      .populate({
        path: 'doctor_id',
        populate: {
          path: 'userId',
          select: 'name email phone'
        }
      })
      .sort({ date: -1, time: -1 })
      .lean();

    // Check for appointments without doctor_id
    const appointmentsWithoutDoctor = appointments.filter(appt => !appt.doctor_id);
    if (appointmentsWithoutDoctor.length > 0) {
      // silent
    }

    // Format appointments for frontend
    const formattedAppointments = appointments.map(appt => ({
      id: appt._id,
      date: new Date(appt.date).toISOString().split('T')[0],
      time: appt.time,
      status: appt.status,
      symptoms: appt.symptoms,
      notes: appt.notes,
      patient: {
        id: appt.user_id?._id,
        name: appt.user_id?.name || "Unknown",
        email: appt.user_id?.email || "Unknown",
        phone: appt.user_id?.phone || "Unknown"
      },
      doctor: {
        id: appt.doctor_id?._id,
        name: appt.doctor_id?.userId?.name || "Unknown",
        email: appt.doctor_id?.userId?.email || "Unknown",
        phone: appt.doctor_id?.userId?.phone || "Unknown",
        specialization: appt.doctor_id?.specialization || "Unknown",
        fees: appt.doctor_id?.fees || 0
      },
      createdAt: appt.createdAt
    }));

    // silent

    res.json({
      appointments: formattedAppointments,
      total: formattedAppointments.length
    });
  } catch (error) {
    console.error("Admin appointments error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== UPDATE Appointment Status (Admin) =====
router.put("/appointments/:id/status", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    const { status } = req.body;
    const { id } = req.params;

    // Validate status
    const validStatuses = ["Pending", "Confirmed", "Completed", "Cancelled", "Rejected", "Expired"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: "Invalid status. Valid statuses are: Pending, Confirmed, Completed, Cancelled, Rejected, Expired" 
      });
    }

    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).populate('user_id', 'name email').populate({
      path: 'doctor_id',
      populate: {
        path: 'userId',
        select: 'name email'
      }
    });

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.json({
      message: "Appointment status updated successfully",
      appointment: {
        id: appointment._id,
        date: new Date(appointment.date).toISOString().split('T')[0],
        time: appointment.time,
        status: appointment.status,
        patient: {
          name: appointment.user_id?.name,
          email: appointment.user_id?.email
        },
        doctor: {
          name: appointment.doctor_id?.userId?.name,
          specialization: appointment.doctor_id?.specialization
        }
      }
    });
  } catch (error) {
    console.error("Admin update appointment status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== DELETE Appointment (Admin) =====
router.delete("/appointments/:id", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    const { id } = req.params;

    const appointment = await Appointment.findByIdAndDelete(id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.json({ message: "Appointment deleted successfully" });
  } catch (error) {
    console.error("Admin delete appointment error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== CREATE Appointment for User (Admin) =====
router.post("/appointments", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    const { user_id, doctor_id, date, time, symptoms, notes, status } = req.body;

    // Validate required fields
    if (!user_id || !doctor_id || !date || !time) {
      return res.status(400).json({ message: "User ID, Doctor ID, date, and time are required" });
    }

    // Check if user exists
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if doctor exists
    const doctor = await Doctor.findById(doctor_id);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Check if appointment already exists for this time slot
    const existingAppointment = await Appointment.findOne({
      doctor_id,
      date,
      time,
      status: { $in: ["Pending", "Confirmed"] }
    });

    if (existingAppointment) {
      return res.status(400).json({ message: "This time slot is already booked" });
    }

    // Create new appointment
    const appointment = new Appointment({
      user_id,
      doctor_id,
      date,
      time,
      symptoms: symptoms || "",
      notes: notes || "",
      status: status || "Confirmed" // Admin can set status directly, default to Confirmed
    });

    await appointment.save();

    // Populate appointment data for response
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('user_id', 'name email phone')
      .populate({
        path: 'doctor_id',
        populate: {
          path: 'userId',
          select: 'name email phone'
        }
      })
      .lean();

    res.status(201).json({
      message: "Appointment booked successfully",
      appointment: {
        id: appointment._id,
        date: new Date(appointment.date).toISOString().split('T')[0],
        time: appointment.time,
        status: appointment.status,
        symptoms: appointment.symptoms,
        notes: appointment.notes,
        patient: {
          id: populatedAppointment.user_id._id,
          name: populatedAppointment.user_id.name,
          email: populatedAppointment.user_id.email,
          phone: populatedAppointment.user_id.phone
        },
        doctor: {
          id: populatedAppointment.doctor_id._id,
          name: populatedAppointment.doctor_id.userId?.name || "Unknown",
          specialization: populatedAppointment.doctor_id.specialization || "Unknown"
        }
      }
    });
  } catch (error) {
    console.error("Admin create appointment error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== GET Admin Dashboard Stats =====
router.get("/dashboard", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    // Get admin details and permissions
    let adminDetails = null;
    try {
      adminDetails = await Admin.findOne({ user_id: req.userId })
        .populate('user_id', 'name email')
        .lean();
    } catch (error) {
      // silent
    }

    // Get statistics
    const totalUsers = await User.countDocuments({ role: "Patient" });
    const totalDoctors = await User.countDocuments({ role: "Doctor" });
    const totalAppointments = await Appointment.countDocuments();
    const pendingAppointments = await Appointment.countDocuments({ status: "Pending" });
    const confirmedAppointments = await Appointment.countDocuments({ status: "Confirmed" });
    const completedAppointments = await Appointment.countDocuments({ status: "Completed" });
    const cancelledAppointments = await Appointment.countDocuments({ status: "Cancelled" });
    const expiredAppointments = await Appointment.countDocuments({ status: "Expired" });

    // Get recent appointments
    const recentAppointments = await Appointment.find()
      .populate('user_id', 'name email')
      .populate({
        path: 'doctor_id',
        populate: {
          path: 'userId',
          select: 'name'
        }
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // silent

    const formattedRecentAppointments = recentAppointments.map(appt => ({
      id: appt._id,
      date: new Date(appt.date).toISOString().split('T')[0],
      time: appt.time,
      status: appt.status,
      patient: appt.user_id?.name || "Unknown",
      doctor: appt.doctor_id?.userId?.name || "Unknown",
      specialization: appt.doctor_id?.specialization || "Unknown"
    }));

    // console.log('Dashboard - Formatted recent appointments:', JSON.stringify(formattedRecentAppointments, null, 2)); // Debug log

    res.json({
      admin: {
        name: adminDetails?.user_id?.name || "Admin",
        email: adminDetails?.user_id?.email || "",
        permissions: adminDetails?.permissions || []
      },
      stats: {
        totalUsers,
        totalDoctors,
        totalAppointments,
        pendingAppointments,
        confirmedAppointments,
        completedAppointments,
        cancelledAppointments,
        expiredAppointments
      },
      recentAppointments: formattedRecentAppointments
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== GET All Users (Admin) =====
router.get("/users", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    const users = await User.find({ role: "Patient" })
      .select('name email phone address dob gender')
      .sort({ createdAt: -1 })
      .lean();

    const formattedUsers = users.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : user.dob,
      gender: user.gender
    }));

    res.json({
      users: formattedUsers,
      total: formattedUsers.length
    });
  } catch (error) {
    console.error("Admin get users error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== CREATE User (Admin) =====
router.post("/users", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    const { name, email, password, gender, phone, address, dob } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Create new user (role will be Patient by default)
    const user = new User({
      name,
      email,
      password,
      gender: gender || undefined,
      phone: phone || undefined,
      address: address || undefined,
      dob: dob || undefined,
      role: "Patient"
    });

    await user.save();

    res.status(201).json({
      message: "User created successfully",
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
    console.error("Admin create user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== DELETE User (Admin) =====
router.delete("/users/:id", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    const { id } = req.params;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete user's appointments first
    await Appointment.deleteMany({ user_id: id });

    // Delete user
    await User.findByIdAndDelete(id);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Admin delete user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== GET All Doctors (Admin) =====
router.get("/doctors", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    const doctors = await Doctor.find()
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();

    const formattedDoctors = doctors.map(doctor => ({
      id: doctor._id,
      name: doctor.userId?.name || "Unknown",
      email: doctor.userId?.email || "Unknown",
      phone: doctor.userId?.phone || "Unknown",
      specialization: doctor.specialization,
      fees: doctor.fees,
      experience: doctor.experience,
      qualification: doctor.qualification,
      createdAt: doctor.createdAt
    }));

    res.json({
      doctors: formattedDoctors,
      total: formattedDoctors.length
    });
  } catch (error) {
    console.error("Admin get doctors error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== CREATE Admin User =====
router.post("/create", auth, async (req, res) => {
  try {
    // Check if current user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can create other admins" });
    }

    const { userId, permissions } = req.body;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is already an admin
    const existingAdmin = await Admin.findOne({ user_id: userId });
    if (existingAdmin) {
      return res.status(400).json({ message: "User is already an admin" });
    }

    // Create admin record
    const admin = new Admin({
      user_id: userId,
      permissions: permissions || ["view_appointments", "manage_appointments", "view_users", "view_doctors"]
    });

    await admin.save();

    // Update user role to Admin
    await User.findByIdAndUpdate(userId, { role: "Admin" });

    res.json({
      message: "Admin created successfully",
      admin: {
        id: admin._id,
        userId: admin.user_id,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    console.error("Create admin error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== GET All Admins =====
router.get("/list", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    const admins = await Admin.find()
      .populate('user_id', 'name email phone role')
      .sort({ createdAt: -1 })
      .lean();

    const formattedAdmins = admins.map(admin => ({
      id: admin._id,
      name: admin.user_id?.name || "Unknown",
      email: admin.user_id?.email || "Unknown",
      phone: admin.user_id?.phone || "Unknown",
      role: admin.user_id?.role || "Admin",
      permissions: admin.permissions,
      createdAt: admin.createdAt
    }));

    res.json({
      admins: formattedAdmins,
      total: formattedAdmins.length
    });
  } catch (error) {
    console.error("Get admins error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== UPDATE Admin Permissions =====
router.put("/permissions/:id", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    const { permissions } = req.body;
    const { id } = req.params;

    const admin = await Admin.findByIdAndUpdate(
      id,
      { permissions },
      { new: true, runValidators: true }
    ).populate('user_id', 'name email');

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.json({
      message: "Admin permissions updated successfully",
      admin: {
        id: admin._id,
        name: admin.user_id?.name,
        email: admin.user_id?.email,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    console.error("Update admin permissions error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== MARK EXPIRED APPOINTMENTS =====
router.post("/mark-expired", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    const currentDate = new Date();
    const result = await Appointment.updateMany(
      { 
        date: { $lt: currentDate },
        status: { $nin: ['Completed', 'Cancelled', 'Expired'] }
      },
      { status: 'Expired' }
    );

    res.json({
      message: `${result.modifiedCount} appointments marked as expired`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Mark expired appointments error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== DELETE Admin =====
router.delete("/:id", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    const { id } = req.params;

    const admin = await Admin.findByIdAndDelete(id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Update user role back to Patient
    await User.findByIdAndUpdate(admin.user_id, { role: "Patient" });

    res.json({ message: "Admin removed successfully" });
  } catch (error) {
    console.error("Delete admin error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== GET All Feedback (Admin) =====
router.get("/feedback", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    const { status } = req.query;

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }

    const feedbacks = await Feedback.find(query)
      .populate('user_id', 'name email phone')
      .populate('responded_by', 'name email')
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
      user: {
        id: feedback.user_id?._id,
        name: feedback.user_id?.name || "Unknown",
        email: feedback.user_id?.email || "Unknown",
        phone: feedback.user_id?.phone || "Unknown"
      },
      responded_by: feedback.responded_by ? {
        id: feedback.responded_by._id,
        name: feedback.responded_by.name,
        email: feedback.responded_by.email
      } : null,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt
    }));

    res.json({
      feedbacks: formattedFeedbacks,
      total: formattedFeedbacks.length
    });
  } catch (error) {
    console.error("Admin get feedback error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== UPDATE Feedback Status (Admin) =====
router.put("/feedback/:id/status", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    const { status } = req.body;
    const { id } = req.params;

    // Validate status
    const validStatuses = ["Pending", "Reviewed", "Resolved", "Archived"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: "Invalid status. Valid statuses are: Pending, Reviewed, Resolved, Archived" 
      });
    }

    const feedback = await Feedback.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    )
      .populate('user_id', 'name email')
      .lean();

    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    res.json({
      message: "Feedback status updated successfully",
      feedback: {
        id: feedback._id,
        subject: feedback.subject,
        status: feedback.status,
        user: {
          name: feedback.user_id?.name,
          email: feedback.user_id?.email
        }
      }
    });
  } catch (error) {
    console.error("Admin update feedback status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== RESPOND to Feedback (Admin) =====
router.put("/feedback/:id/respond", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    const { admin_response, status } = req.body;
    const { id } = req.params;

    if (!admin_response) {
      return res.status(400).json({ message: "Admin response is required" });
    }

    // Update feedback with response
    const updateData = {
      admin_response,
      responded_by: req.userId,
      responded_at: new Date()
    };

    // Update status if provided
    if (status) {
      const validStatuses = ["Pending", "Reviewed", "Resolved", "Archived"];
      if (validStatuses.includes(status)) {
        updateData.status = status;
      }
    } else {
      // Default to Reviewed if status not provided
      updateData.status = "Reviewed";
    }

    const feedback = await Feedback.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('user_id', 'name email')
      .populate('responded_by', 'name email')
      .lean();

    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    res.json({
      message: "Response added successfully",
      feedback: {
        id: feedback._id,
        subject: feedback.subject,
        message: feedback.message,
        admin_response: feedback.admin_response,
        status: feedback.status,
        responded_at: feedback.responded_at,
        user: {
          name: feedback.user_id?.name,
          email: feedback.user_id?.email
        },
        responded_by: feedback.responded_by ? {
          name: feedback.responded_by.name,
          email: feedback.responded_by.email
        } : null
      }
    });
  } catch (error) {
    console.error("Admin respond to feedback error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== DELETE Feedback (Admin) =====
router.delete("/feedback/:id", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== "Admin") {
      return res.status(403).json({ message: "Only admins can access this endpoint" });
    }

    const { id } = req.params;

    const feedback = await Feedback.findByIdAndDelete(id);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    res.json({ message: "Feedback deleted successfully" });
  } catch (error) {
    console.error("Admin delete feedback error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
