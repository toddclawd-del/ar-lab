/**
 * Experiment 04: Surface Detection
 * 
 * Uses WebXR with hit-test to:
 * - Detect horizontal and vertical surfaces
 * - Show reticle at detected surface points
 * - Place 3D objects on real-world surfaces
 */

import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { XR, createXRStore, useXRHitTest, XROrigin } from '@react-three/xr'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import './styles.css'

// Create XR store outside component
const xrStore = createXRStore({
  depthSensing: true,
  hitTest: true,
})

// Placed object types
interface PlacedObject {
  id: string
  position: [number, number, number]
  rotation: [number, number, number]
  type: string
  scale: number
}

// Object options to place
const OBJECT_OPTIONS = [
  { id: 'cube', name: 'Cube', emoji: '📦' },
  { id: 'sphere', name: 'Sphere', emoji: '⚽' },
  { id: 'cylinder', name: 'Cylinder', emoji: '🥫' },
  { id: 'cone', name: 'Cone', emoji: '🔺' },
  { id: 'torus', name: 'Donut', emoji: '🍩' },
  { id: 'tree', name: 'Tree', emoji: '🌲' },
]

// Reticle component for surface indicator
function Reticle({ 
  onPlace, 
}: { 
  onPlace: (position: THREE.Vector3, rotation: THREE.Euler) => void
}) {
  const reticleRef = useRef<THREE.Mesh>(null)
  const lastPosition = useRef(new THREE.Vector3())
  const lastRotation = useRef(new THREE.Euler())
  
  useXRHitTest((hitTestResults, getWorldMatrix) => {
    if (!reticleRef.current || hitTestResults.length === 0) return
    
    // Get world matrix from first hit result
    const matrix = new THREE.Matrix4()
    if (!getWorldMatrix(matrix, hitTestResults[0])) return
    
    // Apply hit test matrix to reticle
    reticleRef.current.visible = true
    reticleRef.current.matrix.copy(matrix)
    reticleRef.current.matrix.decompose(
      reticleRef.current.position,
      reticleRef.current.quaternion,
      reticleRef.current.scale
    )
    
    // Store position for placing objects
    lastPosition.current.copy(reticleRef.current.position)
    lastRotation.current.setFromQuaternion(reticleRef.current.quaternion)
  }, 'viewer')
  
  // Animate reticle
  useFrame((state) => {
    if (!reticleRef.current || !reticleRef.current.visible) return
    const time = state.clock.elapsedTime
    const scale = 0.15 + Math.sin(time * 3) * 0.02
    reticleRef.current.scale.set(scale, scale, scale)
  })
  
  const handleSelect = useCallback(() => {
    if (!reticleRef.current?.visible) return
    onPlace(lastPosition.current.clone(), lastRotation.current.clone())
  }, [onPlace])
  
  // Listen for XR select events
  const { gl } = useThree()
  
  // Set up select listener
  useFrame(() => {
    const session = gl.xr.getSession()
    if (session) {
      session.addEventListener('select', handleSelect)
      return () => session.removeEventListener('select', handleSelect)
    }
  })
  
  return (
    <mesh 
      ref={reticleRef} 
      rotation-x={-Math.PI / 2} 
      visible={false}
      matrixAutoUpdate={false}
    >
      <ringGeometry args={[0.1, 0.12, 32]} />
      <meshBasicMaterial color="#06b6d4" transparent opacity={0.8} side={THREE.DoubleSide} />
      <mesh rotation-x={0}>
        <circleGeometry args={[0.08, 32]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </mesh>
  )
}

// Individual placed object component
function PlacedObjectMesh({ object }: { object: PlacedObject }) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  useFrame((state) => {
    if (!meshRef.current) return
    const time = state.clock.elapsedTime
    // Gentle floating animation
    meshRef.current.position.y = object.position[1] + Math.sin(time * 2 + object.position[0]) * 0.02
    meshRef.current.rotation.y = time * 0.3
  })
  
  const renderGeometry = () => {
    switch (object.type) {
      case 'sphere':
        return <sphereGeometry args={[0.08 * object.scale, 32, 32]} />
      case 'cylinder':
        return <cylinderGeometry args={[0.05 * object.scale, 0.05 * object.scale, 0.15 * object.scale, 32]} />
      case 'cone':
        return <coneGeometry args={[0.07 * object.scale, 0.15 * object.scale, 32]} />
      case 'torus':
        return <torusGeometry args={[0.06 * object.scale, 0.025 * object.scale, 16, 32]} />
      case 'tree':
        return <coneGeometry args={[0.08 * object.scale, 0.2 * object.scale, 8]} />
      case 'cube':
      default:
        return <boxGeometry args={[0.1 * object.scale, 0.1 * object.scale, 0.1 * object.scale]} />
    }
  }
  
  const getColor = () => {
    switch (object.type) {
      case 'sphere': return '#3b82f6'
      case 'cylinder': return '#f59e0b'
      case 'cone': return '#ef4444'
      case 'torus': return '#ec4899'
      case 'tree': return '#22c55e'
      default: return '#667eea'
    }
  }
  
  return (
    <mesh
      ref={meshRef}
      position={object.position}
      rotation={object.rotation}
      castShadow
      receiveShadow
    >
      {renderGeometry()}
      <meshStandardMaterial 
        color={getColor()} 
        metalness={0.3} 
        roughness={0.4}
        envMapIntensity={0.5}
      />
    </mesh>
  )
}

// Scene component
function Scene({ 
  placedObjects,
  onPlace,
}: { 
  placedObjects: PlacedObject[]
  onPlace: (position: THREE.Vector3, rotation: THREE.Euler) => void
}) {
  return (
    <>
      <XROrigin />
      <ambientLight intensity={0.6} />
      <directionalLight 
        position={[5, 5, 5]} 
        intensity={0.8} 
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Environment preset="city" />
      
      <Reticle onPlace={onPlace} />
      
      {placedObjects.map((obj) => (
        <PlacedObjectMesh key={obj.id} object={obj} />
      ))}
    </>
  )
}

// Non-AR fallback scene
function FallbackScene({ placedObjects }: { placedObjects: PlacedObject[] }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <Environment preset="city" />
      
      {/* Ground plane for preview */}
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      
      {/* Grid helper */}
      <gridHelper args={[10, 20, '#333', '#222']} />
      
      {placedObjects.map((obj) => (
        <PlacedObjectMesh key={obj.id} object={obj} />
      ))}
    </>
  )
}

export default function SurfaceDetectionExperiment() {
  const [isARSupported, setIsARSupported] = useState<boolean | null>(null)
  const [isInAR, setIsInAR] = useState(false)
  const [selectedObject, setSelectedObject] = useState('cube')
  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([])
  
  // Check WebXR support
  const checkSupport = useCallback(async () => {
    if (!navigator.xr) {
      setIsARSupported(false)
      return
    }
    
    try {
      const supported = await navigator.xr.isSessionSupported('immersive-ar')
      setIsARSupported(supported)
    } catch {
      setIsARSupported(false)
    }
  }, [])
  
  // Check on mount
  useState(() => {
    checkSupport()
  })
  
  // Handle placing objects
  const handlePlace = useCallback((position: THREE.Vector3, rotation: THREE.Euler) => {
    const newObject: PlacedObject = {
      id: `obj-${Date.now()}`,
      position: [position.x, position.y + 0.05, position.z],
      rotation: [rotation.x, rotation.y, rotation.z],
      type: selectedObject,
      scale: 1,
    }
    setPlacedObjects(prev => [...prev, newObject])
  }, [selectedObject])
  
  // Clear all objects
  const handleClear = useCallback(() => {
    setPlacedObjects([])
  }, [])
  
  // Enter AR
  const handleEnterAR = useCallback(async () => {
    try {
      await xrStore.enterAR()
      setIsInAR(true)
    } catch (err) {
      console.error('Failed to enter AR:', err)
    }
  }, [])
  
  return (
    <div className="experiment-page surface-detection-page">
      <header className="experiment-header">
        <Link to="/" className="back-link">← Back</Link>
        <div>
          <h1>Surface Detection</h1>
          <p>Place objects on real-world surfaces</p>
        </div>
      </header>

      <div className="ar-container-wrapper">
        <div className="ar-container">
          <Canvas
            shadows
            camera={{ position: [0, 1.5, 3], fov: 50 }}
            gl={{ alpha: true }}
          >
            <XR store={xrStore}>
              {isInAR ? (
                <Scene 
                  placedObjects={placedObjects}
                  onPlace={handlePlace}
                />
              ) : (
                <FallbackScene placedObjects={placedObjects} />
              )}
            </XR>
          </Canvas>
          
          {isARSupported === false && (
            <div className="unsupported-overlay">
              <span className="unsupported-icon">📱</span>
              <h3>WebXR AR Not Available</h3>
              <p>Surface detection requires WebXR AR support.</p>
              <ul className="requirements-list">
                <li>Chrome on Android (ARCore devices)</li>
                <li>Safari on iOS 15+ (with WebXR flag)</li>
                <li>Meta Quest Browser</li>
              </ul>
              <p className="fallback-note">Preview mode is shown below.</p>
            </div>
          )}
          
          {!isInAR && isARSupported !== false && (
            <div className="ar-start-overlay">
              <button onClick={handleEnterAR} className="start-ar-button">
                🚀 Enter AR Mode
              </button>
              <p className="ar-note">
                {isARSupported === null ? 'Checking WebXR support...' : 'Tap to place objects on surfaces'}
              </p>
            </div>
          )}
        </div>
        
        {isInAR && (
          <div className="ar-controls">
            <button onClick={handleClear} className="clear-button">
              🗑️ Clear All
            </button>
            <span className="object-count">{placedObjects.length} objects placed</span>
          </div>
        )}
      </div>

      <div className="objects-section">
        <h2>Select Object</h2>
        <p className="section-desc">Choose what to place when you tap:</p>
        <div className="objects-grid">
          {OBJECT_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={`object-button ${selectedObject === option.id ? 'active' : ''}`}
              onClick={() => setSelectedObject(option.id)}
            >
              <span className="object-emoji">{option.emoji}</span>
              <span className="object-name">{option.name}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="info-section">
        <h2>How It Works</h2>
        <ul>
          <li>
            <strong>WebXR Hit Test</strong> — Casts rays to find surfaces
          </li>
          <li>
            <strong>ARCore/ARKit</strong> — Native platform AR engines
          </li>
          <li>
            <strong>Plane Detection</strong> — Identifies horizontal/vertical planes
          </li>
          <li>
            <strong>@react-three/xr</strong> — React bindings for WebXR
          </li>
        </ul>
        
        <h2>Surface Types</h2>
        <ul>
          <li><strong>Horizontal</strong> — Floors, tables, counters</li>
          <li><strong>Vertical</strong> — Walls (limited support)</li>
          <li><strong>Ceiling</strong> — Overhead surfaces (rare)</li>
        </ul>
        
        <h2>Browser Requirements</h2>
        <ul>
          <li><strong>Android</strong> — Chrome 79+ with ARCore device</li>
          <li><strong>iOS</strong> — Safari 15+ (WebXR flag required)</li>
          <li><strong>Quest</strong> — Meta Quest Browser</li>
          <li><strong>Desktop</strong> — Preview only (no AR)</li>
        </ul>
        
        <h2>Use Cases</h2>
        <ul>
          <li>Furniture placement and room planning</li>
          <li>Product visualization at scale</li>
          <li>AR games with physics</li>
          <li>Interior design and decoration</li>
          <li>Educational 3D models in context</li>
        </ul>
      </section>
    </div>
  )
}
