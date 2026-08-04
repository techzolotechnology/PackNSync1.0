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
                        background: '#fffefb',
                        color: '#1f1f1f',
                        border: '1px solid rgba(176, 33, 50, 0.18)',
                        borderRadius: '12px',
                    },
                    success: { iconTheme: { primary: '#b02132', secondary: '#fff' } },
                    error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                }}
            />
        </Router>
    </React.StrictMode>
);
