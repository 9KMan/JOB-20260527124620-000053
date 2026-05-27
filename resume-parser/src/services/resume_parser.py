import os
import re
from datetime import datetime

class ResumeParser:
    """Parse PDF/DOCX resumes and extract relevant information"""

    def __init__(self):
        self.name = None
        self.email = None
        self.phone = None
        self.skills = []
        self.experience = []
        self.education = []
        self.certifications = []

    def parse(self, file_path):
        """Parse a resume file and return structured data"""
        ext = os.path.splitext(file_path)[1].lower()

        if ext == '.pdf':
            text = self._extract_pdf(file_path)
        elif ext in ['.docx', '.doc']:
            text = self._extract_docx(file_path)
        else:
            raise ValueError(f"Unsupported file type: {ext}")

        # Extract structured data
        self._extract_email(text)
        self._extract_phone(text)
        self._extract_name(text)
        self._extract_skills(text)
        self._extract_experience(text)
        self._extract_education(text)
        self._extract_certifications(text)

        return {
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'skills': self.skills,
            'experience': self.experience,
            'education': self.education,
            'certifications': self.certifications
        }

    def _extract_pdf(self, file_path):
        """Extract text from PDF using PyPDF2"""
        import PyPDF2

        text = ""
        try:
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text += page.extract_text() or ""
        except Exception as e:
            print(f"PDF extraction error: {e}")
            text = ""

        return text

    def _extract_docx(self, file_path):
        """Extract text from DOCX using python-docx"""
        from docx import Document

        text = ""
        try:
            doc = Document(file_path)
            for para in doc.paragraphs:
                text += para.text + "\n"
        except Exception as e:
            print(f"DOCX extraction error: {e}")

        return text

    def _extract_email(self, text):
        """Extract email address using regex"""
        email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        match = re.search(email_pattern, text)
        if match:
            self.email = match.group(0).lower()

    def _extract_phone(self, text):
        """Extract phone number using regex"""
        phone_patterns = [
            r'\+?1?\d{9,15}',  # International
            r'\d{3}[-.\s]?\d{3}[-.\s]?\d{4}',  # US format
            r'\d{10,12}',  # Plain digits
        ]

        for pattern in phone_patterns:
            match = re.search(pattern, text)
            if match:
                self.phone = re.sub(r'[^\d+]', '', match.group(0))
                break

    def _extract_name(self, text):
        """Extract name - first capitalized line in document"""
        lines = [l.strip() for l in text.split('\n') if l.strip()]

        # First line is often the name
        for line in lines[:5]:
            # Skip lines that look like email or phone
            if '@' in line or re.search(r'\d{3}', line):
                continue
            # Name is usually 2-4 words, capitalized
            words = line.split()
            if 2 <= len(words) <= 4 and all(w[0].isupper() for w in words if w):
                self.name = line
                break

    def _extract_skills(self, text):
        """Extract skills from text"""
        common_skills = [
            'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust',
            'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask',
            'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
            'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins', 'Git',
            'HTML', 'CSS', 'SASS', 'REST', 'GraphQL', 'Microservices', 'Agile',
            'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'NLP',
            'Data Science', 'Analytics', 'Tableau', 'Power BI', 'Excel'
        ]

        text_lower = text.lower()
        found_skills = []

        for skill in common_skills:
            if skill.lower() in text_lower:
                found_skills.append(skill)

        # Remove duplicates and limit
        self.skills = list(set(found_skills))[:20]

    def _extract_experience(self, text):
        """Extract work experience"""
        # Look for common experience patterns
        exp_patterns = [
            r'(?i)(?:experience|work history)',
            r'(?i)(?:[A-Z][a-z]+)\s+(?:at|@)\s+[A-Z]',
        ]

        # Simple extraction - look for company patterns
        companies = re.findall(r'(?:at|@)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)', text)
        titles = re.findall(r'(?:^|\n)([A-Z][a-z]+(?:\s+[A-Za-z]+)*)\s+(?:at|@)', text, re.MULTILINE)

        for i, company in enumerate(companies[:5]):
            exp = {'company': company.strip()}
            if i < len(titles):
                exp['title'] = titles[i].strip()
            self.experience.append(exp)

    def _extract_education(self, text):
        """Extract education information"""
        universities = [
            'University', 'College', 'Institute', 'School',
            'MIT', 'Stanford', 'Harvard', 'Yale', 'Princeton'
        ]

        for uni in universities:
            pattern = rf'{uni}\s+of\s+([A-Z][a-zA-Z]+(?:\s+[A-Za-z]+)*)'
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                self.education.append({
                    'institution': match.group(0),
                    'degree': 'Unknown',
                    'year': ''
                })
                break

        # Look for degree patterns
        degree_patterns = [
            r'(?i)(?:B\.?S\.?|Bachelor)',
            r'(?i)(?:M\.?S\.?|Master)',
            r'(?i)(?:Ph\.?D\.?)',
        ]

        for pattern in degree_patterns:
            match = re.search(pattern, text)
            if match and self.education:
                self.education[-1]['degree'] = match.group(0)
                break

    def _extract_certifications(self, text):
        """Extract certifications"""
        cert_keywords = ['certified', 'certification', 'certificate', 'AWS', 'Azure', 'Google Cloud']

        for keyword in cert_keywords:
            if keyword.lower() in text.lower():
                # Simple extraction - find lines with cert keyword
                lines = text.split('\n')
                for line in lines:
                    if keyword.lower() in line.lower():
                        cert = line.strip()
                        if cert and len(cert) < 100:
                            self.certifications.append(cert)
