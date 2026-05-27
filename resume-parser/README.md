# Resume Parser Service

Python microservice for parsing PDF/DOCX resumes.

## Setup

```bash
cd resume-parser
pip install -r requirements.txt
cp .env.example .env
python src/app.py
```

## API Endpoints

- `POST /parse` - Upload and parse resume
- `GET /health` - Health check

## Architecture

- Flask web framework
- PyPDF2 for PDF parsing
- python-docx for DOCX parsing
- MongoDB for storage with GridFS for raw files
- TTL indexes for cache expiry (7 days)
