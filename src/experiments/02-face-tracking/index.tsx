/**
 * Experiment 02: Face Tracking with AR Filters
 * 
 * Uses MindAR.js + Three.js for:
 * - Real-time face detection
 * - 3D object placement on face landmarks
 * - Virtual try-on filters (glasses, masks, effects)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import './styles.css'

// MindAR types
interface MindARThreeInstance {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.Camera
  addAnchor: (index: number) => { group: THREE.Group }
  addFaceMesh: () => { material: THREE.Material; geometry: THREE.BufferGeometry; group: THREE.Group }
  start: () => Promise<void>
  stop: () => void
}

interface MindARThreeConstructor {
  new (config: { container: HTMLElement }): MindARThreeInstance
}

declare global {
  interface Window {
    MindARThree: MindARThreeConstructor
  }
}

// Face anchor indices (MediaPipe 468 landmarks)
const ANCHORS = {
  NOSE_TIP: 1,          // Tip of nose
  NOSE_BRIDGE: 168,     // Between eyes (for glasses)
  FOREHEAD: 10,         // Top of forehead (for hats)
  LEFT_EAR: 127,        // Left ear
  RIGHT_EAR: 356,       // Right ear
  CHIN: 152,            // Bottom of chin
  LEFT_EYE: 33,         // Left eye center
  RIGHT_EYE: 263,       // Right eye center
  MOUTH_CENTER: 13,     // Center of mouth
} as const

// Filter definitions
interface Filter {
  id: string
  name: string
  emoji: string
  description: string
  type: 'primitive' | 'gltf' | 'mesh'
  anchor: number
  create: (scene: THREE.Scene, gltfLoader?: GLTFLoader) => THREE.Object3D | Promise<THREE.Object3D>
}

const filters: Filter[] = [
  {
    id: 'glasses',
    name: 'Glasses',
    emoji: '👓',
    description: 'Classic black frames',
    type: 'primitive',
    anchor: ANCHORS.NOSE_BRIDGE,
    create: () => {
      const group = new THREE.Group()
      
      // Frame color
      const frameMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a,
        metalness: 0.8,
        roughness: 0.2
      })
      
      // Lens material (semi-transparent)
      const lensMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4488ff,
        transparent: true,
        opacity: 0.3,
        metalness: 0.1,
        roughness: 0.0
      })
      
      // Left lens
      const leftLens = new THREE.Mesh(
        new THREE.CircleGeometry(0.035, 32),
        lensMaterial
      )
      leftLens.position.set(-0.035, 0.01, 0.01)
      
      // Right lens
      const rightLens = new THREE.Mesh(
        new THREE.CircleGeometry(0.035, 32),
        lensMaterial
      )
      rightLens.position.set(0.035, 0.01, 0.01)
      
      // Left frame
      const leftFrame = new THREE.Mesh(
        new THREE.TorusGeometry(0.035, 0.003, 8, 32),
        frameMaterial
      )
      leftFrame.position.set(-0.035, 0.01, 0.01)
      
      // Right frame
      const rightFrame = new THREE.Mesh(
        new THREE.TorusGeometry(0.035, 0.003, 8, 32),
        frameMaterial
      )
      rightFrame.position.set(0.035, 0.01, 0.01)
      
      // Bridge
      const bridge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.003, 0.003, 0.02, 8),
        frameMaterial
      )
      bridge.rotation.z = Math.PI / 2
      bridge.position.set(0, 0.01, 0.01)
      
      // Temple arms (sides)
      const leftArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.004, 0.004),
        frameMaterial
      )
      leftArm.position.set(-0.09, 0.01, -0.02)
      leftArm.rotation.y = -0.3
      
      const rightArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.004, 0.004),
        frameMaterial
      )
      rightArm.position.set(0.09, 0.01, -0.02)
      rightArm.rotation.y = 0.3
      
      group.add(leftLens, rightLens, leftFrame, rightFrame, bridge, leftArm, rightArm)
      return group
    }
  },
  {
    id: 'nose-sphere',
    name: 'Clown Nose',
    emoji: '🔴',
    description: 'Big red nose',
    type: 'primitive',
    anchor: ANCHORS.NOSE_TIP,
    create: () => {
      const geometry = new THREE.SphereGeometry(0.03, 32, 16)
      const material = new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        metalness: 0.1,
        roughness: 0.8
      })
      const sphere = new THREE.Mesh(geometry, material)
      sphere.position.set(0, 0, 0.01)
      return sphere
    }
  },
  {
    id: 'crown',
    name: 'Crown',
    emoji: '👑',
    description: 'Royal golden crown',
    type: 'primitive',
    anchor: ANCHORS.FOREHEAD,
    create: () => {
      const group = new THREE.Group()
      
      const goldMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffd700,
        metalness: 0.9,
        roughness: 0.1
      })
      
      // Base band
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.06, 0.008, 8, 32, Math.PI),
        goldMaterial
      )
      band.rotation.x = Math.PI / 2
      band.position.set(0, 0.02, 0)
      
      // Spikes
      const spikeGeometry = new THREE.ConeGeometry(0.01, 0.04, 4)
      const spikePositions = [-0.04, -0.02, 0, 0.02, 0.04]
      
      spikePositions.forEach((x) => {
        const spike = new THREE.Mesh(spikeGeometry, goldMaterial)
        spike.position.set(x, 0.05, 0)
        group.add(spike)
      })
      
      // Jewels
      const jewelMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xff0055,
        metalness: 0.3,
        roughness: 0.2,
        emissive: 0x330011,
        emissiveIntensity: 0.3
      })
      
      const jewelGeometry = new THREE.OctahedronGeometry(0.008)
      const jewelPositions = [-0.03, 0, 0.03]
      
      jewelPositions.forEach((x) => {
        const jewel = new THREE.Mesh(jewelGeometry, jewelMaterial)
        jewel.position.set(x, 0.03, 0.01)
        group.add(jewel)
      })
      
      group.add(band)
      return group
    }
  },
  {
    id: 'mustache',
    name: 'Mustache',
    emoji: '🥸',
    description: 'Dapper stache',
    type: 'primitive',
    anchor: ANCHORS.NOSE_TIP,
    create: () => {
      const group = new THREE.Group()
      
      const hairMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2a1810,
        roughness: 1.0,
        metalness: 0
      })
      
      // Left side
      const leftCurve = new THREE.Mesh(
        new THREE.TorusGeometry(0.02, 0.006, 8, 16, Math.PI / 2),
        hairMaterial
      )
      leftCurve.position.set(-0.025, -0.025, 0.015)
      leftCurve.rotation.z = Math.PI / 4
      
      // Right side  
      const rightCurve = new THREE.Mesh(
        new THREE.TorusGeometry(0.02, 0.006, 8, 16, Math.PI / 2),
        hairMaterial
      )
      rightCurve.position.set(0.025, -0.025, 0.015)
      rightCurve.rotation.z = -Math.PI / 4 - Math.PI / 2
      
      // Center connector
      const center = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.012, 0.008),
        hairMaterial
      )
      center.position.set(0, -0.025, 0.015)
      
      group.add(leftCurve, rightCurve, center)
      return group
    }
  },
  {
    id: 'sunglasses',
    name: 'Sunglasses',
    emoji: '😎',
    description: 'Cool shades',
    type: 'primitive',
    anchor: ANCHORS.NOSE_BRIDGE,
    create: () => {
      const group = new THREE.Group()
      
      const frameMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a,
        metalness: 0.9,
        roughness: 0.1
      })
      
      const lensMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x111111,
        transparent: true,
        opacity: 0.85,
        metalness: 0.5,
        roughness: 0.0
      })
      
      // Create aviator-style lenses (slightly larger, teardrop shape)
      const createAviatorLens = (isLeft: boolean) => {
        const shape = new THREE.Shape()
        const w = 0.04
        const h = 0.045
        shape.moveTo(0, h * 0.5)
        shape.quadraticCurveTo(w * 0.6, h * 0.6, w, 0)
        shape.quadraticCurveTo(w * 0.8, -h * 0.6, 0, -h * 0.5)
        shape.quadraticCurveTo(-w * 0.3, -h * 0.3, -w * 0.3, 0)
        shape.quadraticCurveTo(-w * 0.3, h * 0.3, 0, h * 0.5)
        
        const geometry = new THREE.ShapeGeometry(shape)
        const lens = new THREE.Mesh(geometry, lensMaterial)
        lens.position.set(isLeft ? -0.035 : 0.035, 0.005, 0.01)
        if (!isLeft) lens.scale.x = -1
        return lens
      }
      
      group.add(createAviatorLens(true))
      group.add(createAviatorLens(false))
      
      // Bridge
      const bridge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.003, 0.003, 0.015, 8),
        frameMaterial
      )
      bridge.rotation.z = Math.PI / 2
      bridge.position.set(0, 0.01, 0.01)
      group.add(bridge)
      
      // Temple arms
      const armGeometry = new THREE.BoxGeometry(0.1, 0.006, 0.004)
      const leftArm = new THREE.Mesh(armGeometry, frameMaterial)
      leftArm.position.set(-0.1, 0.01, -0.02)
      leftArm.rotation.y = -0.25
      
      const rightArm = new THREE.Mesh(armGeometry, frameMaterial)
      rightArm.position.set(0.1, 0.01, -0.02)
      rightArm.rotation.y = 0.25
      
      group.add(leftArm, rightArm)
      
      return group
    }
  },
  {
    id: 'particles',
    name: 'Sparkles',
    emoji: '✨',
    description: 'Floating particles',
    type: 'primitive',
    anchor: ANCHORS.NOSE_BRIDGE,
    create: () => {
      const group = new THREE.Group()
      
      const particleCount = 30
      const particleGeometry = new THREE.SphereGeometry(0.004, 8, 8)
      
      for (let i = 0; i < particleCount; i++) {
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6),
          emissive: new THREE.Color().setHSL(Math.random(), 0.8, 0.3),
          emissiveIntensity: 0.5,
          metalness: 0.8,
          roughness: 0.2
        })
        
        const particle = new THREE.Mesh(particleGeometry, material)
        particle.position.set(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2 + 0.05,
          (Math.random() - 0.5) * 0.1
        )
        particle.userData = {
          originalY: particle.position.y,
          speed: 0.5 + Math.random() * 1.5,
          phase: Math.random() * Math.PI * 2
        }
        group.add(particle)
      }
      
      // Store animation function on group
      group.userData.animate = (time: number) => {
        group.children.forEach((particle) => {
          if (particle.userData.originalY !== undefined) {
            particle.position.y = particle.userData.originalY + 
              Math.sin(time * particle.userData.speed + particle.userData.phase) * 0.02
            particle.rotation.y = time * particle.userData.speed
          }
        })
      }
      
      return group
    }
  }
]

export default function FaceTrackingExperiment() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mindarRef = useRef<MindARThreeInstance | null>(null)
  const animationRef = useRef<number | null>(null)
  const activeFiltersRef = useRef<Map<string, THREE.Object3D>>(new Map())
  const anchorsRef = useRef<Map<number, THREE.Group>>(new Map())
  
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['glasses']))
  const [error, setError] = useState<string | null>(null)
  const [loadingProgress, setLoadingProgress] = useState<string>('Initializing...')

  // Load MindAR from CDN
  const loadMindAR = useCallback(async () => {
    if (window.MindARThree) return true

    setLoadingProgress('Loading MindAR...')
    
    return new Promise<boolean>((resolve) => {
      // Use a script with src (more reliable on mobile Safari than textContent)
      const script = document.createElement('script')
      script.type = 'module'
      // Use our loader file which imports MindAR and sets window.MindARThree
      script.src = import.meta.env.BASE_URL + 'mindar-loader.js'
      
      const handleLoad = () => {
        window.removeEventListener('mindar-loaded', handleLoad)
        clearTimeout(timeoutId)
        resolve(true)
      }
      
      const handleError = () => {
        clearTimeout(timeoutId)
        console.error('MindAR script failed to load')
        resolve(false)
      }
      
      window.addEventListener('mindar-loaded', handleLoad)
      script.addEventListener('error', handleError)
      document.head.appendChild(script)
      
      // Timeout fallback
      const timeoutId = setTimeout(() => {
        if (!window.MindARThree) {
          window.removeEventListener('mindar-loaded', handleLoad)
          console.error('MindAR load timed out')
          resolve(false)
        }
      }, 20000)
    })
  }, [])

  // Initialize AR
  const initAR = useCallback(async () => {
    if (!containerRef.current || !window.MindARThree) return false
    
    try {
      setLoadingProgress('Setting up camera...')
      
      const mindarThree = new window.MindARThree({
        container: containerRef.current
      })
      
      mindarRef.current = mindarThree
      const { scene } = mindarThree

      // Add lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
      scene.add(ambientLight)
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
      directionalLight.position.set(0, 1, 1)
      scene.add(directionalLight)

      // Create anchors for all anchor points we might need
      const uniqueAnchors = new Set(filters.map(f => f.anchor))
      uniqueAnchors.forEach((anchorIndex) => {
        const anchor = mindarThree.addAnchor(anchorIndex)
        anchorsRef.current.set(anchorIndex, anchor.group)
      })

      setLoadingProgress('Ready!')
      return true
    } catch (err) {
      console.error('AR init failed:', err)
      setError('Failed to initialize AR. Please check camera permissions.')
      return false
    }
  }, [])

  // Add filter to scene
  const addFilter = useCallback(async (filter: Filter) => {
    const anchorGroup = anchorsRef.current.get(filter.anchor)
    if (!anchorGroup) return

    const gltfLoader = new GLTFLoader()
    const object = await filter.create(mindarRef.current!.scene, gltfLoader)
    anchorGroup.add(object)
    activeFiltersRef.current.set(filter.id, object)
  }, [])

  // Remove filter from scene
  const removeFilter = useCallback((filter: Filter) => {
    const object = activeFiltersRef.current.get(filter.id)
    const anchorGroup = anchorsRef.current.get(filter.anchor)
    
    if (object && anchorGroup) {
      anchorGroup.remove(object)
      activeFiltersRef.current.delete(filter.id)
    }
  }, [])

  // Toggle filter
  const toggleFilter = useCallback((filter: Filter) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(filter.id)) {
        next.delete(filter.id)
        removeFilter(filter)
      } else {
        next.add(filter.id)
        if (isRunning) {
          addFilter(filter)
        }
      }
      return next
    })
  }, [isRunning, addFilter, removeFilter])

  // Start AR session
  const startAR = useCallback(async () => {
    if (!mindarRef.current) return
    
    try {
      setLoadingProgress('Starting camera...')
      await mindarRef.current.start()
      
      // Add currently selected filters
      for (const filter of filters) {
        if (activeFilters.has(filter.id)) {
          await addFilter(filter)
        }
      }
      
      // Start render loop
      const animate = () => {
        if (!mindarRef.current) return
        
        const time = performance.now() / 1000
        
        // Animate any filters that have animation functions
        activeFiltersRef.current.forEach((object) => {
          if (object.userData.animate) {
            object.userData.animate(time)
          }
        })
        
        mindarRef.current.renderer.render(
          mindarRef.current.scene,
          mindarRef.current.camera
        )
        animationRef.current = requestAnimationFrame(animate)
      }
      
      animate()
      setIsRunning(true)
      setIsLoading(false)
    } catch (err) {
      console.error('Failed to start AR:', err)
      setError('Failed to start camera. Please grant camera permissions and try again.')
    }
  }, [activeFilters, addFilter])

  // Stop AR session
  const stopAR = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    
    if (mindarRef.current) {
      mindarRef.current.stop()
    }
    
    activeFiltersRef.current.clear()
    setIsRunning(false)
  }, [])

  // Initialize on mount
  useEffect(() => {
    let mounted = true
    
    const init = async () => {
      const mindARLoaded = await loadMindAR()
      if (!mounted) return
      
      if (!mindARLoaded) {
        setError('Failed to load MindAR. Please check your internet connection.')
        setIsLoading(false)
        return
      }
      
      const arReady = await initAR()
      if (!mounted) return
      
      if (arReady) {
        setIsLoading(false)
      }
    }
    
    init()
    
    return () => {
      mounted = false
      stopAR()
    }
  }, [loadMindAR, initAR, stopAR])

  return (
    <div className="experiment-page face-tracking-page">
      <header className="experiment-header">
        <Link to="/" className="back-link">← Back</Link>
        <div>
          <h1>Face Tracking</h1>
          <p>AR filters with real-time face detection</p>
        </div>
      </header>

      <div className="ar-container-wrapper">
        <div 
          ref={containerRef} 
          className={`ar-container ${isRunning ? 'active' : ''}`}
        >
          {isLoading && (
            <div className="loading-overlay">
              <div className="loading-spinner" />
              <p>{loadingProgress}</p>
            </div>
          )}
          
          {error && (
            <div className="error-overlay">
              <span className="error-icon">⚠️</span>
              <p>{error}</p>
              <button onClick={() => window.location.reload()}>
                Retry
              </button>
            </div>
          )}
          
          {!isRunning && !isLoading && !error && (
            <div className="start-overlay">
              <button onClick={startAR} className="start-button">
                📷 Start Camera
              </button>
              <p className="permission-note">
                Requires camera permission
              </p>
            </div>
          )}
        </div>

        {isRunning && (
          <button onClick={stopAR} className="stop-button">
            ⏹ Stop
          </button>
        )}
      </div>

      <div className="filters-section">
        <h2>Filters</h2>
        <div className="filters-grid">
          {filters.map((filter) => (
            <button
              key={filter.id}
              className={`filter-button ${activeFilters.has(filter.id) ? 'active' : ''}`}
              onClick={() => toggleFilter(filter)}
            >
              <span className="filter-emoji">{filter.emoji}</span>
              <span className="filter-name">{filter.name}</span>
              <span className="filter-desc">{filter.description}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="info-section">
        <h2>How It Works</h2>
        <ul>
          <li>
            <strong>MindAR.js</strong> — Open-source face tracking library
          </li>
          <li>
            <strong>MediaPipe</strong> — Google's ML face detection (468 landmarks)
          </li>
          <li>
            <strong>Three.js</strong> — 3D rendering and filter effects
          </li>
          <li>
            <strong>WebRTC</strong> — Camera access via getUserMedia
          </li>
        </ul>
        
        <h2>Browser Requirements</h2>
        <ul>
          <li><strong>Chrome / Edge / Safari</strong> — Recommended</li>
          <li><strong>Camera permission</strong> — Required</li>
          <li><strong>HTTPS</strong> — Required for camera access</li>
          <li><strong>WebGL</strong> — Hardware acceleration helps</li>
        </ul>
        
        <h2>Face Anchor Points</h2>
        <ul>
          <li><strong>Nose Bridge (168)</strong> — Glasses, masks</li>
          <li><strong>Nose Tip (1)</strong> — Nose effects</li>
          <li><strong>Forehead (10)</strong> — Hats, crowns</li>
          <li><strong>Ears (127, 356)</strong> — Earrings</li>
          <li><strong>Mouth (13)</strong> — Mouth effects</li>
        </ul>
        
        <h2>Use Cases</h2>
        <ul>
          <li>Virtual try-on (glasses, makeup, accessories)</li>
          <li>Social media filters and effects</li>
          <li>Video conferencing enhancements</li>
          <li>Interactive marketing experiences</li>
        </ul>
      </section>
    </div>
  )
}
