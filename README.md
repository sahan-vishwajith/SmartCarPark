# CarPark - React + Flask Full Stack Application

A full-stack web application with a React frontend and Flask backend, ready for deployment on Render.

## Project Structure

```
CarPark/
├── frontend/          # React application
├── backend/           # Flask API
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js (v14+)
- Python (v3.9+)
- Git

## Local Development

### Backend Setup

```bash
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

Backend will run on `http://localhost:5000`

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend will run on `http://localhost:3000`

## Deployment on Render

### Deploy Backend

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Create new "Web Service"
3. Connect your GitHub repository
4. Set Root Directory to `backend`
5. Set Build Command: `pip install -r requirements.txt`
6. Set Start Command: `gunicorn app:app`
7. Add Environment Variable: `PYTHON_VERSION=3.9`

### Deploy Frontend

1. Create new "Static Site"
2. Connect your GitHub repository
3. Set Root Directory to `frontend`
4. Set Build Command: `npm install && npm run build`
5. Set Publish Directory: `build`

## Environment Variables

Create a `.env` file in the frontend directory:

```
REACT_APP_API_URL=http://localhost:5000  # or your Render backend URL
```

## Features

- React 18 for modern frontend
- Flask for REST API
- CORS enabled for cross-origin requests
- Production-ready configurations
- Environment-based API URLs

## Running Both Simultaneously (Development)

Open two terminals:

Terminal 1:
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python app.py
```

Terminal 2:
```bash
cd frontend
npm start
```

## API Endpoints

- `GET /api/health` - Health check endpoint
- Add your custom routes in `backend/app.py`

## Next Steps

1. Customize the Flask API in `backend/app.py`
2. Build your React components in `frontend/src/`
3. Update API endpoints in React components
4. Test locally before deploying
5. Push to GitHub and connect Render services

