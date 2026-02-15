# Quick Start Guide

Get your CarPark application running locally in 5 minutes!

## Prerequisites

- **Node.js** (v14+) - [Download](https://nodejs.org/)
- **Python** (v3.9+) - [Download](https://www.python.org/)
- **Git** - [Download](https://git-scm.com/)

## Local Development (Windows)

### Terminal 1: Start Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Backend will be available at: **http://localhost:5000**

### Terminal 2: Start Frontend

```powershell
cd frontend
npm install
npm start
```

Frontend will open at: **http://localhost:3000**

## Local Development (macOS/Linux)

### Terminal 1: Start Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

### Terminal 2: Start Frontend

```bash
cd frontend
npm install
npm start
```

## Testing the Connection

1. Open **http://localhost:3000** in your browser
2. You should see the CarPark app
3. Check if "Backend Status" shows ✓ Backend is connected
4. If not, check the browser console for errors

## Project Structure

```
CarPark/
├── backend/
│   ├── app.py              # Flask API
│   ├── requirements.txt    # Python dependencies
│   └── README.md          # Backend docs
├── frontend/
│   ├── src/
│   │   ├── App.js         # Main React component
│   │   ├── services/      # API client
│   │   └── index.js       # Entry point
│   ├── package.json       # Node dependencies
│   └── README.md          # Frontend docs
├── README.md              # Project overview
├── DEPLOYMENT.md          # Render deployment guide
└── .gitignore            # Git ignore rules
```

## What's Included

### Backend (Flask)
- ✅ CORS enabled for frontend communication
- ✅ Health check endpoint
- ✅ Error handling
- ✅ Environment variables support
- ✅ Ready for Render deployment

### Frontend (React)
- ✅ Modern React 18 with hooks
- ✅ Axios HTTP client
- ✅ API service layer
- ✅ Responsive design
- ✅ Backend connectivity check

## Common Commands

### Backend

```bash
# Activate virtual environment
venv\Scripts\activate           # Windows
source venv/bin/activate        # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run development server
python app.py

# Add new dependencies
pip install package-name
pip freeze > requirements.txt   # Update requirements.txt
```

### Frontend

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Add new dependencies
npm install package-name
```

## Adding Features

### Adding a Backend Endpoint

Edit `backend/app.py`:

```python
@app.route('/api/your-endpoint', methods=['GET', 'POST'])
def your_endpoint():
    # Your code here
    return jsonify({'result': 'success'}), 200
```

### Adding a Frontend Component

Create `frontend/src/components/YourComponent.js`:

```javascript
import React from 'react';

function YourComponent() {
  return <div>Your component</div>;
}

export default YourComponent;
```

Then use it in `App.js`:

```javascript
import YourComponent from './components/YourComponent';

// In App component:
<YourComponent />
```

### Calling Backend API from Frontend

In any React component:

```javascript
import api from '../services/api';

// Inside useEffect or event handler:
const response = await api.get('/your-endpoint');
console.log(response.data);
```

## Environment Variables

### Backend (.env)
```
FLASK_ENV=development
PORT=5000
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:5000
```

For production (Render), update `REACT_APP_API_URL` to your backend's Render URL.

## Troubleshooting

### Backend won't start
```bash
# Check Python version
python --version

# Try different port
PORT=8000 python app.py
```

### Frontend won't connect to backend
- Check if backend is running (http://localhost:5000)
- Check REACT_APP_API_URL in frontend .env
- Check browser console for errors (F12)
- Check backend CORS settings

### npm install fails
```bash
# Clear npm cache
npm cache clean --force

# Try again
npm install
```

### pip install fails
```bash
# Upgrade pip
python -m pip install --upgrade pip

# Try again
pip install -r requirements.txt
```

## Next Steps

1. ✅ Run locally and test
2. 📝 Add your features
3. 🧪 Test thoroughly
4. 📤 Push to GitHub
5. 🚀 Deploy to Render (see DEPLOYMENT.md)

## Useful Resources

- **React Docs:** https://react.dev
- **Flask Docs:** https://flask.palletsprojects.com
- **Axios Docs:** https://axios-http.com
- **Render Docs:** https://render.com/docs

## Support

For issues:
1. Check the backend logs: Terminal running Flask
2. Check browser console: Press F12 in browser
3. Check Render logs: Dashboard → Service → Logs

Happy coding! 🚗

