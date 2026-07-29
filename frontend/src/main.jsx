import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import './index.css';
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Router>
            <App />
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: '#1e2837',
                        color: '#f1f5f9',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '12px',
                    },
                    success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
                    error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                }}
            />
        </Router>
    </React.StrictMode>
);
