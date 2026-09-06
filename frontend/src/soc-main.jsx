import './memoryStorageInit.js';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import React from 'react'
import ReactDOM from 'react-dom/client'
import SOCApp from './soc/SOCApp'
import './soc/styles/soc.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SOCApp />
  </React.StrictMode>
)
