# CarPark Frontend

React 18 frontend application for the CarPark parking management system.

## Getting Started

### Prerequisites
- Node.js (v14+)
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm start
```

Runs the app in development mode at `http://localhost:3000`

### Building for Production

```bash
npm run build
```

Builds the app for production to the `build` folder.

## Environment Variables

Create a `.env` file in the frontend directory:

```
REACT_APP_API_URL=http://localhost:5000
```

For Render deployment, set this to your backend's Render URL:
```
REACT_APP_API_URL=https://your-backend-app.onrender.com
```

## Project Structure

```
src/
├── components/       # React components
├── services/        # API service
├── App.js          # Main App component
├── App.css         # App styles
├── index.js        # Entry point
└── index.css       # Global styles
public/
└── index.html      # HTML template
package.json        # Dependencies and scripts
```

## Features

- Modern React 18 with hooks
- Axios for API calls
- Responsive design
- Error handling
- API health check

