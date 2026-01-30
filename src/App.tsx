import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import './App.css'

// Experiments
import ModelViewer from './experiments/01-model-viewer'
import FaceTracking from './experiments/02-face-tracking'

const experiments = [
  {
    id: '01-model-viewer',
    title: 'Model Viewer',
    description: '3D model with AR quick-look support',
    component: ModelViewer,
    status: 'done' as const,
  },
  {
    id: '02-face-tracking',
    title: 'Face Tracking',
    description: 'Face detection and filter overlays',
    component: FaceTracking,
    status: 'done' as const,
  },
  {
    id: '03-image-tracking',
    title: 'Image Tracking',
    description: 'Recognize images and overlay 3D content',
    component: null,
    status: 'planned' as const,
  },
  {
    id: '04-surface-detection',
    title: 'Surface Detection',
    description: 'Place objects on real-world surfaces',
    component: null,
    status: 'planned' as const,
  },
  {
    id: '05-world-tracking',
    title: 'World Tracking',
    description: 'Persistent AR anchors in space',
    component: null,
    status: 'planned' as const,
  },
]

function Gallery() {
  return (
    <div className="gallery">
      <header className="gallery-header">
        <h1>AR Lab</h1>
        <p>Web-based augmented reality experiments</p>
      </header>
      
      <div className="experiments-grid">
        {experiments.map((exp) => (
          <div key={exp.id} className={`experiment-card ${exp.status}`}>
            {exp.status === 'done' ? (
              <Link to={`/${exp.id}`} className="experiment-link">
                <div className="experiment-number">{exp.id.split('-')[0]}</div>
                <h2>{exp.title}</h2>
                <p>{exp.description}</p>
                <span className="status-badge">Ready</span>
              </Link>
            ) : (
              <div className="experiment-placeholder">
                <div className="experiment-number">{exp.id.split('-')[0]}</div>
                <h2>{exp.title}</h2>
                <p>{exp.description}</p>
                <span className="status-badge planned">Coming Soon</span>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <footer className="gallery-footer">
        <p>Built with Three.js, WebXR, and React</p>
      </footer>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter basename="/ar-lab">
      <Routes>
        <Route path="/" element={<Gallery />} />
        {experiments
          .filter((exp) => exp.component)
          .map((exp) => (
            <Route
              key={exp.id}
              path={`/${exp.id}`}
              element={exp.component ? <exp.component /> : null}
            />
          ))}
      </Routes>
    </BrowserRouter>
  )
}

export default App
