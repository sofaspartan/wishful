import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './fonts.css';
import '../../../src/styles/tokens.css';
import './popup.css';
import { applyBrand } from '../../../src/config/applyBrand';
import { Popup } from './Popup';

applyBrand();
// Popup is always Wishful’s light sky theme (matches the site’s cloud look).
document.documentElement.dataset.theme = 'light';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
