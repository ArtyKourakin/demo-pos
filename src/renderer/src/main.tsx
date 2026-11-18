import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { DataProvider } from './data'
import { ToastProvider } from './components/Toasts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </ToastProvider>
  </StrictMode>
)
