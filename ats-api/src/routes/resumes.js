const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: '/tmp/resumes/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and DOCX allowed.'));
    }
  }
});

const ResumeDocument = require('../models/resumeDocument');

// POST /api/resumes/upload - Upload resume
router.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const candidate_id = req.body.candidate_id;

    // Send to Python resume parser service
    const FormData = require('form-data');
    const axios = require('axios');
    const fs = require('fs');

    const form = new FormData();
    form.append('file', fs.createReadStream(req.file.path));
    if (candidate_id) {
      form.append('candidate_id', candidate_id);
    }

    try {
      const parserResponse = await axios.post(
        `${process.env.RESUME_PARSER_URL || 'http://localhost:5000'}/parse`,
        form,
        { headers: form.getHeaders(), timeout: 30000 }
      );

      const parsedData = parserResponse.data;

      // Store in MongoDB
      const resumeDoc = await ResumeDocument.create({
        candidate_id,
        file_name: req.file.originalname,
        file_type: path.extname(req.file.originalname).replace('.', ''),
        parsed_data: parsedData,
        parse_confidence: parsedData.confidence || 0.5,
        raw_uploaded_at: new Date()
      });

      res.json({
        message: 'Resume uploaded and parsed',
        resume_id: resumeDoc._id,
        parsed_data: parsedData
      });
    } catch (parserError) {
      console.error('Resume parser error:', parserError.message);
      // Still save raw file reference even if parsing fails
      const resumeDoc = await ResumeDocument.create({
        candidate_id,
        file_name: req.file.originalname,
        file_type: path.extname(req.file.originalname).replace('.', ''),
        parsed_data: null,
        parse_confidence: 0,
        raw_uploaded_at: new Date()
      });

      res.json({
        message: 'Resume uploaded but parsing failed',
        resume_id: resumeDoc._id
      });
    }
  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({ error: 'Failed to upload resume' });
  }
});

// GET /api/resumes/:candidateId/latest - Get latest parsed resume
router.get('/:candidateId/latest', async (req, res) => {
  try {
    const resume = await ResumeDocument.findOne({ candidate_id: req.params.candidateId })
      .sort({ parsed_at: -1 });

    if (!resume) {
      return res.status(404).json({ error: 'No resume found for candidate' });
    }

    res.json(resume);
  } catch (error) {
    console.error('Get resume error:', error);
    res.status(500).json({ error: 'Failed to fetch resume' });
  }
});

module.exports = router;