import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import './index.css';
import './motion.css';
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Router>
            <App />
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: '#ffffff',
                        color: '#292966',
                        border: '1px solid rgba(92, 92, 153, 0.28)',
                        borderRadius: '12px',
                    },
                    success: { iconTheme: { primary: '#5c5c99', secondary: '#fff' } },
                    error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                }}
            />
        </Router>
    </React.StrictMode>
);
