from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Enable CORS for all routes
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Environment variables
DEBUG = os.getenv('FLASK_ENV') == 'development'
PORT = int(os.getenv('PORT', 5000))


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'Flask backend is running'
    }), 200


@app.route('/api/info', methods=['GET'])
def get_info():
    """Get API info"""
    return jsonify({
        'app_name': 'CarPark API',
        'version': '1.0.0',
        'environment': os.getenv('FLASK_ENV', 'production')
    }), 200


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'error': 'Not Found',
        'message': 'The requested resource was not found'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({
        'error': 'Internal Server Error',
        'message': 'An unexpected error occurred'
    }), 500


if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=PORT,
        debug=DEBUG
    )

