import React, { useEffect, useState } from 'react';
import './App.css';
import api from './services/api';

function App() {
  const [apiStatus, setApiStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkApiHealth();
  }, []);

  const checkApiHealth = async () => {
    try {
      setLoading(true);
      const response = await api.get('/health');
      setApiStatus(response.data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setApiStatus(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🅿️ CarPark</h1>
        <p>Parking Management System</p>
      </header>

      <main className="App-main">
        <div className="status-card">
          <h2>Backend Status</h2>
          {loading && <p className="loading">Checking backend...</p>}
          {error && <p className="error">Error: {error}</p>}
          {apiStatus && (
            <div className="status-info">
              <p className="success">✓ Backend is connected</p>
              <p><strong>Status:</strong> {apiStatus.status}</p>
              <p><strong>Message:</strong> {apiStatus.message}</p>
            </div>
          )}
          <button onClick={checkApiHealth}>Refresh Status</button>
        </div>

        <section className="welcome">
          <h2>Welcome to CarPark</h2>
          <p>This is your React + Flask full-stack application.</p>
          <p>Edit <code>src/App.js</code> to get started!</p>
        </section>
      </main>
    </div>
  );
}

export default App;

