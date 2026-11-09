import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './fonts.css';
import '../../../src/styles/tokens.css';
import './popup.css';
import { applyBrand } from '../../../src/config/brand';
import { Popup } from './Popup';

applyBrand();
const dark = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => (document.documentElement.dataset.theme = dark.matches ? 'dark' : 'light');
applyTheme();
dark.addEventListener('change', applyTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
