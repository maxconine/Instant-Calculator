import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { QuickCalcPage } from './components/QuickCalc'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QuickCalcPage />
  </StrictMode>,
)
