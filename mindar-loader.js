// MindAR Loader - Loads MindAR and exposes it globally
// Using a separate file fixes mobile Safari issues with inline module scripts

import { MindARThree } from 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-face-three.prod.js';

window.MindARThree = MindARThree;
window.dispatchEvent(new CustomEvent('mindar-loaded'));
