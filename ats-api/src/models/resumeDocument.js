const mongoose = require('mongoose');

const resumeDocumentSchema = new mongoose.Schema({
  candidate_id: { type: String, index: true },
  raw_file_id: { type: mongoose.Schema.Types.ObjectId },
  file_name: String,
  file_type: String,
  parsed_data: {
    name: String,
    email: String,
    phone: String,
    experience: [{
      company: String,
      title: String,
      duration: String
    }],
    education: [{
      institution: String,
      degree: String,
      year: String
    }],
    skills: [String],
    certifications: [String]
  },
  parse_confidence: { type: Number, default: 0 },
  parsed_at: { type: Date },
  raw_uploaded_at: { type: Date, default: Date.now }
}, { timestamps: true });

// TTL index for cache - 7 days expiry
resumeDocumentSchema.index({ 'parsed_data.email': 1 }, { expireAfterSeconds: 604800 });

const ResumeDocument = mongoose.model('ResumeDocument', resumeDocumentSchema);

module.exports = ResumeDocument;