const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
  patient_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  doctor_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Doctor', 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['Active', 'Closed', 'Completed'], 
    default: 'Active' 
  },
  subject: {
    type: String,
    default: ""
  }
}, { timestamps: true });

module.exports = mongoose.model("Consultation", consultationSchema);
