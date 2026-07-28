import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import React from 'react'
import ReactDOM from 'react-dom/client'
import LoginApp from './login/LoginApp'
import './login/styles/login.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LoginApp />
  </React.StrictMode>
)
