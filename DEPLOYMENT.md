# Deployment Guide - Render

This guide explains how to deploy your CarPark application to Render.

## Prerequisites

1. **GitHub Account** - Your code must be on GitHub
2. **Render Account** - Sign up at [render.com](https://render.com)
3. **Git** - Installed on your local machine

## Step 1: Push to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: React + Flask setup"

# Add remote (replace with your GitHub URL)
git remote add origin https://github.com/YOUR_USERNAME/CarPark.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 2: Deploy Backend to Render

### Option A: Using render.yaml (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" and select "Blueprint"
3. Connect your GitHub account
4. Select your repository
5. Render will automatically detect and deploy both services from `render.yaml`

### Option B: Manual Deployment

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Fill in:
   - **Name:** carpark-backend
   - **Root Directory:** backend
   - **Environment:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
5. Add Environment Variables:
   - `PYTHON_VERSION` = `3.9`
   - `FLASK_ENV` = `production`
6. Click "Create Web Service"
7. Wait for deployment to complete
8. Copy the URL (e.g., `https://carpark-backend.onrender.com`)

## Step 3: Deploy Frontend to Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Static Site"
3. Connect your GitHub repository
4. Fill in:
   - **Name:** carpark-frontend
   - **Root Directory:** frontend
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `build`
5. Add Environment Variables:
   - `REACT_APP_API_URL` = `https://carpark-backend.onrender.com` (use your backend URL)
6. Click "Create Static Site"
7. Wait for deployment to complete

## Step 4: Configure Environment Variables

### Backend (.env file on Render)
```
PYTHON_VERSION=3.9
FLASK_ENV=production
PORT=5000
```

### Frontend (.env.production on Render)
```
REACT_APP_API_URL=https://your-backend-url.onrender.com
```

## Step 5: Test Your Deployment

1. Go to your frontend URL
2. Check if the "Backend Status" card shows "✓ Backend is connected"
3. If not connected:
   - Check the backend URL in `.env`
   - Verify CORS is enabled in backend
   - Check browser console for errors

## Updating Your Application

Every time you push to GitHub:

```bash
git add .
git commit -m "Your message"
git push
```

Render will automatically rebuild and redeploy both services.

## Monitoring and Logs

### View Logs
1. Go to your service on Render Dashboard
2. Click "Logs" tab
3. View real-time logs

### Troubleshooting

**Backend won't start:**
- Check logs for Python errors
- Ensure all dependencies are in `requirements.txt`
- Verify Flask can bind to port 5000

**Frontend can't connect to backend:**
- Check `REACT_APP_API_URL` environment variable
- Verify backend is running
- Check browser console for CORS errors
- Ensure backend CORS allows frontend origin

**Static files not loading:**
- Verify `build` folder is created
- Check Publish Directory is set to `build`
- Clear browser cache

## Performance Tips

1. **Enable Gzip compression** in Flask
2. **Use CDN** for static assets
3. **Optimize images** before deploying
4. **Monitor resource usage** in Render Dashboard

## Cost Considerations

- **Free tier** available but limited
- **Paid plans** start at $7/month
- Dynamic services (backend) require paid tier
- Static sites can be free

## Scaling

As your app grows:

1. **Add database** - Render supports PostgreSQL
2. **Use Redis** for caching
3. **Optimize queries**
4. **Add load balancing**

## Domain Setup

1. Go to your service settings
2. Click "Custom Domain"
3. Add your domain
4. Update DNS records at your registrar

## SSL Certificate

Render automatically provides free SSL certificates for all services.

## Rolling Back

If deployment fails:

1. Go to Render Dashboard
2. Click your service
3. Find the previous deployment
4. Click "Deploy"

## Getting Help

- **Render Docs:** https://render.com/docs
- **Common Issues:** Check Render status page
- **Support:** Render provides email support

## Next Steps

1. ✅ Deployed to Render
2. 📝 Add your business logic
3. 🗄️ Connect a database
4. 🔐 Add authentication
5. 📊 Set up monitoring

