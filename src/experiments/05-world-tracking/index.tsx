/**
 * Experiment 05: World Tracking
 * 
 * Uses WebXR with anchors for:
 * - Full 6DOF world tracking
 * - Persistent anchors that stay in place
 * - Multi-object AR scene building
 */

import { useCallback, useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { XR, createXRStore, useXRHitTest, XROrigin } from '@react-three/xr'
import { Environment, Text, Float, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'
import './styles.css'

// Create XR store with anchor support
const xrStore = createXRStore({
  depthSensing: true,
  hitTest: true,
  anchors: true,
  domOverlay: true,
})

// Anchor types for world tracking
interface WorldAnchor {
  id: string
  position: [number, number, number]
  rotation: [number, number, number]
  type: string
  label?: string
  color: string
  createdAt: number
}

// Scene types
const SCENE_PRESETS = [
  {
    id: 'markers',
    name: 'Spatial Markers',
    emoji: '📍',
    description: 'Place markers to remember locations',
  },
  {
    id: 'portals',
    name: 'AR Portals',
    emoji: '🌀',
    description: 'Create floating portal effects',
  },
  {
    id: 'notes',
    name: 'Sticky Notes',
    emoji: '📝',
    description: 'Leave notes in physical space',
  },
  {
    id: 'lights',
    name: 'Light Orbs',
    emoji: '💡',
    description: 'Place glowing light sources',
  },
]

// Colors for anchors
const ANCHOR_COLORS = [
  '#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
]

// Spatial Marker component
function SpatialMarker({ anchor }: { anchor: WorldAnchor }) {
  const meshRef = useRef<THREE.Group>(null)
  
  useFrame((state) => {
    if (!meshRef.current) return
    const time = state.clock.elapsedTime
    meshRef.current.rotation.y = time * 0.5
  })
  
  return (
    <group ref={meshRef} position={anchor.position} rotation={anchor.rotation}>
      {/* Pin head */}
      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial 
          color={anchor.color} 
          metalness={0.7} 
          roughness={0.3}
          emissive={anchor.color}
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Pin body */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.01, 0.015, 0.12, 16]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Ground ring */}
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.05, 0.07, 32]} />
        <meshBasicMaterial color={anchor.color} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// Portal component
function PortalAnchor({ anchor }: { anchor: WorldAnchor }) {
  const groupRef = useRef<THREE.Group>(null)
  
  useFrame((state) => {
    if (!groupRef.current) return
    const time = state.clock.elapsedTime
    groupRef.current.rotation.y = time * 0.3
    groupRef.current.children.forEach((child, i) => {
      if (child.type === 'Mesh' && i > 1) {
        child.rotation.z = time * (1 + i * 0.2)
      }
    })
  })
  
  return (
    <group ref={groupRef} position={anchor.position}>
      {/* Portal ring */}
      <mesh>
        <torusGeometry args={[0.15, 0.015, 16, 64]} />
        <meshStandardMaterial 
          color={anchor.color} 
          metalness={0.9} 
          roughness={0.1}
          emissive={anchor.color}
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Inner portal */}
      <mesh position-z={0.01}>
        <circleGeometry args={[0.13, 64]} />
        <meshBasicMaterial 
          color="#000022" 
          transparent 
          opacity={0.8}
          side={THREE.DoubleSide} 
        />
      </mesh>
      {/* Orbiting particles */}
      {[...Array(12)].map((_, i) => (
        <mesh 
          key={i} 
          position={[
            Math.cos((i / 12) * Math.PI * 2) * 0.12,
            Math.sin((i / 12) * Math.PI * 2) * 0.12,
            0.02
          ]}
        >
          <sphereGeometry args={[0.008, 8, 8]} />
          <meshBasicMaterial color={anchor.color} />
        </mesh>
      ))}
    </group>
  )
}

// Sticky Note component
function StickyNote({ anchor }: { anchor: WorldAnchor }) {
  const groupRef = useRef<THREE.Group>(null)
  
  useFrame((state) => {
    if (!groupRef.current) return
    // Billboard effect - face camera
    const camera = state.camera
    groupRef.current.lookAt(camera.position)
  })
  
  return (
    <Float speed={2} rotationIntensity={0.1} floatIntensity={0.2}>
      <group ref={groupRef} position={anchor.position}>
        {/* Note background */}
        <mesh>
          <planeGeometry args={[0.15, 0.12]} />
          <meshBasicMaterial color={anchor.color} side={THREE.DoubleSide} />
        </mesh>
        {/* Note text */}
        <Text
          position={[0, 0, 0.001]}
          fontSize={0.02}
          color="#000"
          anchorX="center"
          anchorY="middle"
          maxWidth={0.13}
        >
          {anchor.label || 'Note'}
        </Text>
        {/* Shadow */}
        <mesh position={[0.005, -0.005, -0.001]}>
          <planeGeometry args={[0.15, 0.12]} />
          <meshBasicMaterial color="#000" transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </Float>
  )
}

// Light Orb component
function LightOrb({ anchor }: { anchor: WorldAnchor }) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  useFrame((state) => {
    if (!meshRef.current) return
    const time = state.clock.elapsedTime
    meshRef.current.position.y = anchor.position[1] + 0.1 + Math.sin(time * 2) * 0.03
  })
  
  return (
    <group position={anchor.position}>
      {/* Glowing orb */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.06, 32, 32]} />
        <MeshDistortMaterial
          color={anchor.color}
          emissive={anchor.color}
          emissiveIntensity={0.8}
          transparent
          opacity={0.9}
          distort={0.2}
          speed={2}
        />
      </mesh>
      {/* Light source */}
      <pointLight 
        color={anchor.color} 
        intensity={0.5} 
        distance={1}
        position={[0, 0.1, 0]}
      />
      {/* Ground glow */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <circleGeometry args={[0.1, 32]} />
        <meshBasicMaterial 
          color={anchor.color} 
          transparent 
          opacity={0.3}
          side={THREE.DoubleSide} 
        />
      </mesh>
    </group>
  )
}

// Render the appropriate anchor type
function AnchorRenderer({ anchor }: { anchor: WorldAnchor }) {
  switch (anchor.type) {
    case 'markers':
      return <SpatialMarker anchor={anchor} />
    case 'portals':
      return <PortalAnchor anchor={anchor} />
    case 'notes':
      return <StickyNote anchor={anchor} />
    case 'lights':
      return <LightOrb anchor={anchor} />
    default:
      return <SpatialMarker anchor={anchor} />
  }
}

// Placement reticle with hit test
function PlacementReticle({ 
  onPlace,
  anchorColor,
}: { 
  onPlace: (position: THREE.Vector3, rotation: THREE.Euler) => void
  anchorColor: string
}) {
  const reticleRef = useRef<THREE.Mesh>(null)
  const lastPosition = useRef(new THREE.Vector3())
  const lastRotation = useRef(new THREE.Euler())
  const { gl } = useThree()
  
  useXRHitTest((hitTestResults, getWorldMatrix) => {
    if (!reticleRef.current || hitTestResults.length === 0) return
    
    // Get world matrix from first hit result
    const matrix = new THREE.Matrix4()
    if (!getWorldMatrix(matrix, hitTestResults[0])) return
    
    reticleRef.current.visible = true
    reticleRef.current.matrix.copy(matrix)
    reticleRef.current.matrix.decompose(
      reticleRef.current.position,
      reticleRef.current.quaternion,
      reticleRef.current.scale
    )
    
    lastPosition.current.copy(reticleRef.current.position)
    lastRotation.current.setFromQuaternion(reticleRef.current.quaternion)
  }, 'viewer')
  
  // Animate reticle
  useFrame((state) => {
    if (!reticleRef.current?.visible) return
    const time = state.clock.elapsedTime
    const innerScale = 0.12 + Math.sin(time * 4) * 0.01
    reticleRef.current.scale.set(innerScale, innerScale, innerScale)
  })
  
  // Handle select
  useEffect(() => {
    const session = gl.xr.getSession()
    if (!session) return
    
    const handleSelect = () => {
      if (!reticleRef.current?.visible) return
      onPlace(lastPosition.current.clone(), lastRotation.current.clone())
    }
    
    session.addEventListener('select', handleSelect)
    return () => session.removeEventListener('select', handleSelect)
  }, [gl, onPlace])
  
  return (
    <mesh 
      ref={reticleRef} 
      rotation-x={-Math.PI / 2} 
      visible={false}
      matrixAutoUpdate={false}
    >
      <ringGeometry args={[0.08, 0.1, 32]} />
      <meshBasicMaterial color={anchorColor} transparent opacity={0.8} side={THREE.DoubleSide} />
      <mesh>
        <ringGeometry args={[0.04, 0.06, 32]} />
        <meshBasicMaterial color={anchorColor} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </mesh>
  )
}

// AR Scene
function ARScene({ 
  anchors,
  onPlace,
  anchorColor,
}: { 
  anchors: WorldAnchor[]
  onPlace: (position: THREE.Vector3, rotation: THREE.Euler) => void
  anchorColor: string
}) {
  return (
    <>
      <XROrigin />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.5} />
      <Environment preset="city" />
      
      <PlacementReticle 
        onPlace={onPlace}
        anchorColor={anchorColor}
      />
      
      {anchors.map((anchor) => (
        <AnchorRenderer key={anchor.id} anchor={anchor} />
      ))}
    </>
  )
}

// Fallback preview scene
function PreviewScene({ anchors }: { anchors: WorldAnchor[] }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />
      <Environment preset="city" />
      
      <mesh rotation-x={-Math.PI / 2} position-y={0}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      
      <gridHelper args={[10, 20, '#333', '#222']} />
      
      {anchors.length === 0 && (
        <Float speed={1} rotationIntensity={0.5} floatIntensity={0.3}>
          <Text
            position={[0, 0.5, 0]}
            fontSize={0.1}
            color="#666"
            anchorX="center"
            anchorY="middle"
          >
            Enter AR to place anchors
          </Text>
        </Float>
      )}
      
      {anchors.map((anchor) => (
        <AnchorRenderer key={anchor.id} anchor={anchor} />
      ))}
    </>
  )
}

export default function WorldTrackingExperiment() {
  const [isARSupported, setIsARSupported] = useState<boolean | null>(null)
  const [isInAR, setIsInAR] = useState(false)
  const [selectedType, setSelectedType] = useState('markers')
  const [selectedColor, setSelectedColor] = useState(ANCHOR_COLORS[4])
  const [noteText, setNoteText] = useState('Hello!')
  const [anchors, setAnchors] = useState<WorldAnchor[]>([])
  
  // Check WebXR support
  useEffect(() => {
    const check = async () => {
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
    }
    check()
  }, [])
  
  // Place anchor
  const handlePlace = useCallback((position: THREE.Vector3, rotation: THREE.Euler) => {
    const newAnchor: WorldAnchor = {
      id: `anchor-${Date.now()}`,
      position: [position.x, position.y, position.z],
      rotation: [rotation.x, rotation.y, rotation.z],
      type: selectedType,
      label: selectedType === 'notes' ? noteText : undefined,
      color: selectedColor,
      createdAt: Date.now(),
    }
    setAnchors(prev => [...prev, newAnchor])
  }, [selectedType, selectedColor, noteText])
  
  // Clear anchors
  const handleClear = useCallback(() => {
    setAnchors([])
  }, [])
  
  // Undo last anchor
  const handleUndo = useCallback(() => {
    setAnchors(prev => prev.slice(0, -1))
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
    <div className="experiment-page world-tracking-page">
      <header className="experiment-header">
        <Link to="/" className="back-link">← Back</Link>
        <div>
          <h1>World Tracking</h1>
          <p>Persistent anchors in 3D space</p>
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
                <ARScene 
                  anchors={anchors}
                  onPlace={handlePlace}
                  anchorColor={selectedColor}
                />
              ) : (
                <PreviewScene anchors={anchors} />
              )}
            </XR>
          </Canvas>
          
          {isARSupported === false && (
            <div className="unsupported-overlay">
              <span className="unsupported-icon">🌐</span>
              <h3>WebXR AR Not Available</h3>
              <p>World tracking requires WebXR AR with anchor support.</p>
              <ul className="requirements-list">
                <li>Chrome on Android (ARCore)</li>
                <li>Meta Quest Browser</li>
              </ul>
            </div>
          )}
          
          {!isInAR && isARSupported !== false && (
            <div className="ar-start-overlay">
              <button onClick={handleEnterAR} className="start-ar-button">
                🌍 Enter World AR
              </button>
              <p className="ar-note">6DOF tracking with persistent anchors</p>
            </div>
          )}
        </div>
        
        {isInAR && (
          <div className="ar-controls">
            <button onClick={handleUndo} className="control-btn" disabled={anchors.length === 0}>
              ↩️ Undo
            </button>
            <span className="anchor-count">{anchors.length} anchors</span>
            <button onClick={handleClear} className="control-btn" disabled={anchors.length === 0}>
              🗑️ Clear
            </button>
          </div>
        )}
      </div>

      <div className="options-section">
        <div className="option-group">
          <h2>Anchor Type</h2>
          <div className="type-grid">
            {SCENE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`type-button ${selectedType === preset.id ? 'active' : ''}`}
                onClick={() => setSelectedType(preset.id)}
              >
                <span className="type-emoji">{preset.emoji}</span>
                <span className="type-name">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div className="option-group">
          <h2>Color</h2>
          <div className="color-grid">
            {ANCHOR_COLORS.map((color) => (
              <button
                key={color}
                className={`color-button ${selectedColor === color ? 'active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
              />
            ))}
          </div>
        </div>
        
        {selectedType === 'notes' && (
          <div className="option-group">
            <h2>Note Text</h2>
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Enter note text..."
              className="note-input"
              maxLength={30}
            />
          </div>
        )}
      </div>

      <section className="info-section">
        <h2>How It Works</h2>
        <ul>
          <li>
            <strong>6DOF Tracking</strong> — Full position and rotation tracking
          </li>
          <li>
            <strong>WebXR Anchors</strong> — Persistent spatial references
          </li>
          <li>
            <strong>SLAM</strong> — Simultaneous Localization and Mapping
          </li>
          <li>
            <strong>Feature Points</strong> — Environment understanding
          </li>
        </ul>
        
        <h2>Anchor Types</h2>
        <ul>
          <li><strong>Spatial Markers</strong> — Pin locations in space</li>
          <li><strong>AR Portals</strong> — Floating dimensional effects</li>
          <li><strong>Sticky Notes</strong> — Leave messages anywhere</li>
          <li><strong>Light Orbs</strong> — Place dynamic lighting</li>
        </ul>
        
        <h2>Persistence</h2>
        <ul>
          <li><strong>Session persistence</strong> — Anchors survive camera movement</li>
          <li><strong>Re-localization</strong> — AR system tracks position continuously</li>
          <li><strong>Cloud anchors</strong> — Share across devices (future)</li>
        </ul>
        
        <h2>Use Cases</h2>
        <ul>
          <li>Indoor navigation and wayfinding</li>
          <li>Spatial note-taking and collaboration</li>
          <li>AR scene building and design</li>
          <li>Location-based gaming</li>
          <li>Multi-user shared experiences</li>
        </ul>
      </section>
    </div>
  )
}
