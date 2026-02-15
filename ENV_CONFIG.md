# Environment Configuration

This file documents all environment variables used in the CarPark application.

## Backend Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Flask Environment
FLASK_ENV=development     # Change to 'production' for deployment
PORT=5000                 # Port to run Flask on

# Database (when you add database)
# DATABASE_URL=postgresql://user:password@localhost/carpark

# API Configuration
# API_KEY=your_api_key_here
# SECRET_KEY=your_secret_key_here
```

### Environment Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_ENV` | `production` | Set to `development` for debug mode |
| `PORT` | `5000` | Port for Flask server |
| `DEBUG` | `False` | Enable Flask debug mode |

## Frontend Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
# API Configuration
REACT_APP_API_URL=http://localhost:5000

# Environment
REACT_APP_ENV=development
```

### Render Production Environment

For frontend on Render:
```env
REACT_APP_API_URL=https://carpark-backend.onrender.com
REACT_APP_ENV=production
```

### Environment Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `REACT_APP_API_URL` | `http://localhost:5000` | Backend API URL |
| `REACT_APP_ENV` | `development` | Application environment |

## Important Notes

1. **Never commit `.env` files** to Git (they're in `.gitignore`)
2. **Keep `.env.example`** as a template for other developers
3. **Sensitive data** like API keys should be in `.env` only
4. **Local vs Production** - Use different URLs for local and production
5. **REACT_APP_ prefix** - React requires this prefix for client-side env vars

## Setting Variables on Render

### For Backend (Web Service)

1. Go to Dashboard → Your Service → Settings
2. Scroll to "Environment"
3. Add variables:
   ```
   PYTHON_VERSION = 3.9
   FLASK_ENV = production
   ```

### For Frontend (Static Site)

1. Go to Dashboard → Your Service → Settings
2. Scroll to "Environment"
3. Add variables:
   ```
   REACT_APP_API_URL = https://carpark-backend.onrender.com
   REACT_APP_ENV = production
   ```

## Local Development Setup

### Windows PowerShell

```powershell
# Backend
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
$env:FLASK_ENV = "development"
$env:PORT = "5000"
pip install -r requirements.txt
python app.py

# Frontend (in new terminal)
cd frontend
npm install
$env:REACT_APP_API_URL = "http://localhost:5000"
npm start
```

### macOS/Linux (Bash)

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
export FLASK_ENV=development
export PORT=5000
pip install -r requirements.txt
python app.py

# Frontend (in new terminal)
cd frontend
npm install
export REACT_APP_API_URL=http://localhost:5000
npm start
```

## Viewing Environment Variables

### Backend (Python)

```python
import os
api_url = os.getenv('API_URL')
port = int(os.getenv('PORT', 5000))
```

### Frontend (React)

```javascript
const apiUrl = process.env.REACT_APP_API_URL;
const env = process.env.REACT_APP_ENV;
console.log(`API URL: ${apiUrl}`);
```

## When to Update Environment Variables

1. **Adding new features** that need configuration
2. **Changing API endpoints**
3. **Switching between environments** (dev/prod)
4. **Adding new secrets/keys**
5. **Changing database connections**

## Best Practices

✅ **DO:**
- Keep `.env.example` updated with all variables
- Use descriptive variable names
- Document what each variable does
- Use different values for dev/prod
- Store sensitive data in `.env` only
- Never share `.env` files

❌ **DON'T:**
- Commit `.env` to Git
- Use quotes around values (except for special cases)
- Mix production and development variables
- Leave secrets in code
- Use generic names like `VAR1`, `VAR2`
- Hardcode configuration values

## Troubleshooting

### Variable not being read
1. Check file is named exactly `.env`
2. Restart the application
3. Verify variable name matches exactly
4. For React, ensure `REACT_APP_` prefix is used

### Different values in prod vs dev
1. Check which `.env` file you're using
2. Verify Render environment variables
3. Clear browser cache
4. Restart services after changing

## Additional Resources

- [Python-dotenv docs](https://python-dotenv.readthedocs.io/)
- [Create React App .env docs](https://create-react-app.dev/docs/adding-environment-variables/)
- [Render Environment Variables](https://render.com/docs/environment-variables)

