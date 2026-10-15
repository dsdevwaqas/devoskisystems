import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './fluid-background.css';
import './site.css';
import './forms.css';
import 'locomotive-scroll/dist/locomotive-scroll.css';
import './typography.css';
import './motion.css';
import './preloader.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
