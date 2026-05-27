import os
import hashlib
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from pymongo import MongoClient
from bson.objectid import ObjectId

from services.resume_parser import ResumeParser

parser_bp = Blueprint('parser', __name__)

mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/ats_platform')
mongo_client = MongoClient(mongo_uri)
db = mongo_client.get_database()

ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@parser_bp.route('/parse', methods=['POST'])
def parse_resume():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        candidate_id = request.form.get('candidate_id')

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Allowed: pdf, docx, doc'}), 400

        # Save file temporarily
        filename = secure_filename(file.filename)
        temp_path = f'/tmp/{filename}'
        file.save(temp_path)

        # Parse resume
        parser = ResumeParser()
        parsed_data = parser.parse(temp_path)

        # Calculate confidence
        confidence = calculate_confidence(parsed_data)

        # Store in MongoDB
        resume_doc = {
            'candidate_id': candidate_id,
            'file_name': filename,
            'file_type': filename.rsplit('.', 1)[1].lower(),
            'parsed_data': parsed_data,
            'parse_confidence': confidence,
            'parsed_at': datetime.utcnow(),
            'raw_uploaded_at': datetime.utcnow()
        }

        # Store raw file in GridFS
        with open(temp_path, 'rb') as f:
            file_id = db.fs.files.insert_one({
                'filename': filename,
                'uploadDate': datetime.utcnow()
            })
            db.fs.chunks.insert_one({
                'files_id': file_id,
                'n': 0,
                'data': f.read()
            })
            resume_doc['raw_file_id'] = file_id

        result = db.resume_documents.insert_one(resume_doc)
        resume_doc['_id'] = result.inserted_id

        # Cache parsed summary
        if parsed_data.get('email'):
            cache_key = hashlib.sha256(
                f"{parsed_data['email']}{parsed_data.get('phone', '')}".encode()
            ).hexdigest()

            db.parsed_resume_cache.insert_one({
                'email_hash': cache_key,
                'parsed_summary': parsed_data,
                'cached_at': datetime.utcnow(),
                'expires_at': datetime.utcnow()
            })

        # Clean up temp file
        os.remove(temp_path)

        return jsonify({
            'success': True,
            'resume_id': str(resume_doc['_id']),
            'parsed_data': parsed_data,
            'confidence': confidence
        })

    except Exception as e:
        print(f"Parse error: {str(e)}")
        return jsonify({'error': f'Failed to parse resume: {str(e)}'}), 500

def calculate_confidence(parsed_data):
    """Calculate parsing confidence based on fields extracted"""
    score = 0.0
    fields = ['name', 'email', 'phone', 'skills', 'experience', 'education']

    for field in fields:
        if parsed_data.get(field):
            score += 1.0

    # Bonus for email format validation
    if parsed_data.get('email') and '@' in parsed_data['email']:
        score += 0.5

    return min(score / (len(fields) + 0.5), 1.0)

@parser_bp.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})
