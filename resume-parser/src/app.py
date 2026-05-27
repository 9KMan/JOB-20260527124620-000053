import os
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from pymongo import MongoClient
import hashlib
from datetime import datetime

from routes.parser import parser_bp
from services.resume_parser import ResumeParser

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB limit

# MongoDB connection
mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/ats_platform')
mongo_client = MongoClient(mongo_uri)
db = mongo_client.get_database()

# Register blueprints
app.register_blueprint(parser_bp)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'resume-parser'})

@app.route('/', methods=['GET'])
def index():
    return jsonify({
        'service': 'Resume Parser',
        'version': '1.0.0',
        'endpoints': ['/parse', '/health']
    })

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_DEBUG', 'false').lower() == 'true')
