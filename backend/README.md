# CarPark Backend

Flask REST API for the CarPark parking management system.

## Getting Started

### Prerequisites
- Python (v3.9+)
- pip
- Virtual environment

### Installation

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Development

```bash
python app.py
```

The API will run on `http://localhost:5000`

### Production

```bash
gunicorn app:app
```

## Environment Variables

Create a `.env` file:

```
FLASK_ENV=development
PORT=5000
```

## API Endpoints

### Health Check
- **GET** `/api/health` - Check if API is running
  - Response: `{ "status": "healthy", "message": "Flask backend is running" }`

### Info
- **GET** `/api/info` - Get API information
  - Response: `{ "app_name": "CarPark API", "version": "1.0.0", "environment": "production" }`

## CORS Configuration

CORS is enabled for all routes under `/api/*` to allow cross-origin requests from the React frontend.

## Project Structure

```
backend/
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── .env.example       # Example environment variables
├── .gitignore         # Git ignore rules
└── README.md          # This file
```

## Deployment on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +"
3. Select "Web Service"
4. Connect your GitHub repository
5. Fill in the following:
   - **Name:** carpark-backend (or your preferred name)
   - **Root Directory:** backend
   - **Environment:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
6. Add Environment Variables:
   - `PYTHON_VERSION=3.9`
   - `FLASK_ENV=production`
7. Click "Create Web Service"

## Adding Routes

Add new routes to `app.py`:

```python
@app.route('/api/your-endpoint', methods=['GET', 'POST'])
def your_endpoint():
    data = request.json if request.method == 'POST' else {}
    return jsonify({ 'result': 'your response' }), 200
```

## Error Handling

The API includes built-in error handlers for:
- 404 Not Found
- 500 Internal Server Error

## Testing

You can test the API using curl, Postman, or the React frontend:

```bash
curl http://localhost:5000/api/health
```

