/**
 * Experiment 01: Model Viewer with AR
 * 
 * Uses Google's <model-viewer> for:
 * - 3D model display
 * - AR Quick Look (iOS) / Scene Viewer (Android)
 * - Gesture controls (rotate, zoom, pan)
 */

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import '@google/model-viewer'
import './styles.css'

// Sample models (free from Google)
const models = [
  {
    name: 'Astronaut',
    src: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    poster: 'https://modelviewer.dev/shared-assets/models/Astronaut.webp',
  },
  {
    name: 'Robot',
    src: 'https://modelviewer.dev/shared-assets/models/RobotExpressive.glb',
    poster: '',
  },
  {
    name: 'Boom Box',
    src: 'https://modelviewer.dev/shared-assets/models/glTF-Sample-Assets/Models/BoomBox/glTF-Binary/BoomBox.glb',
    poster: '',
  },
]

export default function ModelViewerExperiment() {
  useEffect(() => {
    // Dynamically import model-viewer if not already loaded
    if (!customElements.get('model-viewer')) {
      import('@google/model-viewer')
    }
  }, [])

  return (
    <div className="experiment-page model-viewer-page">
      <header className="experiment-header">
        <Link to="/" className="back-link">← Back</Link>
        <div>
          <h1>Model Viewer</h1>
          <p>3D models with built-in AR support</p>
        </div>
      </header>

      <main className="model-grid">
        {models.map((model) => (
          <div key={model.name} className="model-card">
            <div
              dangerouslySetInnerHTML={{
                __html: `
                  <model-viewer
                    src="${model.src}"
                    alt="${model.name}"
                    ar
                    ar-modes="webxr scene-viewer quick-look"
                    camera-controls
                    auto-rotate
                    shadow-intensity="1"
                    environment-image="neutral"
                    loading="lazy"
                    style="width: 100%; height: 300px; background-color: #1a1a1a;"
                  >
                    <button slot="ar-button" class="ar-button">
                      👁️ View in AR
                    </button>
                  </model-viewer>
                `
              }}
            />
            <h3>{model.name}</h3>
          </div>
        ))}
      </main>

      <section className="info-section">
        <h2>How It Works</h2>
        <ul>
          <li><strong>iOS:</strong> Uses AR Quick Look (native Safari)</li>
          <li><strong>Android:</strong> Uses Scene Viewer or WebXR</li>
          <li><strong>Desktop:</strong> 3D preview only (no AR)</li>
        </ul>
        
        <h2>Supported Formats</h2>
        <ul>
          <li><strong>glTF / GLB</strong> — Best for web</li>
          <li><strong>USDZ</strong> — Required for iOS AR Quick Look</li>
        </ul>
        
        <h2>Use Cases</h2>
        <ul>
          <li>Product previews (furniture, fashion, electronics)</li>
          <li>Educational models (anatomy, architecture)</li>
          <li>Art & collectibles (NFTs, sculptures)</li>
        </ul>
      </section>
    </div>
  )
}
