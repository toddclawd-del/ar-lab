/**
 * Experiment 03: Image Tracking
 * 
 * Uses MindAR.js image tracking to:
 * - Recognize specific images/markers
 * - Overlay 3D content on detected images
 * - Track image position and orientation in real-time
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import './styles.css'

// MindAR Image Tracking types
interface MindARThreeInstance {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.Camera
  addAnchor: (index: number) => { 
    group: THREE.Group
    onTargetFound: () => void
    onTargetLost: () => void
  }
  start: () => Promise<void>
  stop: () => void
}

interface MindARThreeConstructor {
  new (config: { 
    container: HTMLElement
    imageTargetSrc: string
    maxTrack?: number
    uiLoading?: string
    uiScanning?: string
    uiError?: string
  }): MindARThreeInstance
}

declare global {
  interface Window {
    MindARThreeImage: MindARThreeConstructor
  }
}

// 3D content options to place on detected images
const CONTENT_OPTIONS = [
  {
    id: 'cube',
    name: 'Spinning Cube',
    emoji: '🎲',
  },
  {
    id: 'model',
    name: '3D Robot',
    emoji: '🤖',
  },
  {
    id: 'info-card',
    name: 'Info Panel',
    emoji: '📋',
  },
  {
    id: 'portal',
    name: 'AR Portal',
    emoji: '🌀',
  },
]

export default function ImageTrackingExperiment() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mindarRef = useRef<MindARThreeInstance | null>(null)
  const animationRef = useRef<number | null>(null)
  const contentRef = useRef<THREE.Object3D | null>(null)
  
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [selectedContent, setSelectedContent] = useState('cube')
  const [targetFound, setTargetFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingProgress, setLoadingProgress] = useState('Initializing...')

  // Load MindAR Image tracking from CDN
  const loadMindAR = useCallback(async () => {
    if (window.MindARThreeImage) return true

    setLoadingProgress('Loading MindAR Image Tracking...')
    
    return new Promise<boolean>((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js'
      
      script.onload = () => {
        // MindAR exposes itself differently for image tracking
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any
        if (win.MINDAR?.IMAGE?.MindARThree) {
          window.MindARThreeImage = win.MINDAR.IMAGE.MindARThree
        }
        resolve(!!window.MindARThreeImage)
      }
      
      script.onerror = () => {
        console.error('Failed to load MindAR Image script')
        resolve(false)
      }
      
      document.head.appendChild(script)
      
      setTimeout(() => {
        if (!window.MindARThreeImage) {
          resolve(false)
        }
      }, 15000)
    })
  }, [])

  // Create 3D content based on selection
  const createContent = useCallback((type: string, _scene: THREE.Scene): THREE.Object3D => {
    switch (type) {
      case 'cube': {
        const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
        const material = new THREE.MeshStandardMaterial({ 
          color: 0x667eea,
          metalness: 0.5,
          roughness: 0.3
        })
        const cube = new THREE.Mesh(geometry, material)
        cube.position.set(0, 0.25, 0)
        cube.userData.animate = (time: number) => {
          cube.rotation.y = time
          cube.rotation.x = Math.sin(time * 0.5) * 0.3
        }
        return cube
      }
      
      case 'model': {
        const group = new THREE.Group()
        const loader = new GLTFLoader()
        loader.load(
          'https://modelviewer.dev/shared-assets/models/RobotExpressive.glb',
          (gltf) => {
            const model = gltf.scene
            model.scale.set(0.15, 0.15, 0.15)
            model.position.set(0, 0, 0)
            group.add(model)
            
            // Simple bounce animation
            group.userData.animate = (time: number) => {
              model.position.y = Math.sin(time * 2) * 0.05
              model.rotation.y = time * 0.5
            }
          },
          undefined,
          (err) => console.error('Failed to load model:', err)
        )
        return group
      }
      
      case 'info-card': {
        const group = new THREE.Group()
        
        // Card background
        const cardGeometry = new THREE.PlaneGeometry(0.6, 0.4)
        const cardMaterial = new THREE.MeshBasicMaterial({ 
          color: 0x1a1a2e,
          side: THREE.DoubleSide
        })
        const card = new THREE.Mesh(cardGeometry, cardMaterial)
        card.position.z = 0.01
        group.add(card)
        
        // Border glow
        const borderGeometry = new THREE.PlaneGeometry(0.62, 0.42)
        const borderMaterial = new THREE.MeshBasicMaterial({
          color: 0x667eea,
          side: THREE.DoubleSide
        })
        const border = new THREE.Mesh(borderGeometry, borderMaterial)
        group.add(border)
        
        // Animated particles
        const particleCount = 20
        for (let i = 0; i < particleCount; i++) {
          const particleGeometry = new THREE.SphereGeometry(0.01, 8, 8)
          const particleMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 0.8, 0.6)
          })
          const particle = new THREE.Mesh(particleGeometry, particleMaterial)
          particle.position.set(
            (Math.random() - 0.5) * 0.6,
            (Math.random() - 0.5) * 0.4,
            0.05 + Math.random() * 0.1
          )
          particle.userData.speed = 0.5 + Math.random()
          particle.userData.phase = Math.random() * Math.PI * 2
          group.add(particle)
        }
        
        group.userData.animate = (time: number) => {
          group.children.forEach((child) => {
            if (child.userData.speed) {
              child.position.z = 0.05 + Math.sin(time * child.userData.speed + child.userData.phase) * 0.03
            }
          })
        }
        
        return group
      }
      
      case 'portal': {
        const group = new THREE.Group()
        
        // Portal ring
        const ringGeometry = new THREE.TorusGeometry(0.25, 0.02, 16, 32)
        const ringMaterial = new THREE.MeshStandardMaterial({
          color: 0x667eea,
          emissive: 0x334477,
          emissiveIntensity: 0.5,
          metalness: 0.8,
          roughness: 0.2
        })
        const ring = new THREE.Mesh(ringGeometry, ringMaterial)
        group.add(ring)
        
        // Inner portal effect
        const portalGeometry = new THREE.CircleGeometry(0.23, 32)
        const portalMaterial = new THREE.MeshBasicMaterial({
          color: 0x000033,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide
        })
        const portal = new THREE.Mesh(portalGeometry, portalMaterial)
        portal.position.z = 0.01
        group.add(portal)
        
        // Swirling particles
        const particleCount = 30
        for (let i = 0; i < particleCount; i++) {
          const angle = (i / particleCount) * Math.PI * 2
          const radius = 0.1 + Math.random() * 0.12
          const particleGeometry = new THREE.SphereGeometry(0.008, 8, 8)
          const particleMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 0.8, 0.7)
          })
          const particle = new THREE.Mesh(particleGeometry, particleMaterial)
          particle.userData.angle = angle
          particle.userData.radius = radius
          particle.userData.speed = 0.5 + Math.random() * 1
          group.add(particle)
        }
        
        group.userData.animate = (time: number) => {
          ring.rotation.z = time * 0.3
          group.children.forEach((child) => {
            if (child.userData.angle !== undefined) {
              const angle = child.userData.angle + time * child.userData.speed
              child.position.x = Math.cos(angle) * child.userData.radius
              child.position.y = Math.sin(angle) * child.userData.radius
              child.position.z = 0.02 + Math.sin(time * 2 + child.userData.angle) * 0.02
            }
          })
        }
        
        return group
      }
      
      default:
        return new THREE.Group()
    }
  }, [])

  // Initialize AR
  const initAR = useCallback(async () => {
    if (!containerRef.current || !window.MindARThreeImage) return false
    
    try {
      setLoadingProgress('Setting up image tracking...')
      
      // Use the default MindAR target file
      const mindarThree = new window.MindARThreeImage({
        container: containerRef.current,
        imageTargetSrc: 'https://cdn.jsdelivr.net/gh/nicolo-rancan/AR-mind-file-targets@main/targets.mind',
        maxTrack: 1,
        uiLoading: 'no',
        uiScanning: 'no',
        uiError: 'no'
      })
      
      mindarRef.current = mindarThree
      const { scene } = mindarThree

      // Add lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
      scene.add(ambientLight)
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6)
      directionalLight.position.set(0, 1, 1)
      scene.add(directionalLight)

      // Create anchor for the first target
      const anchor = mindarThree.addAnchor(0)
      
      // Create and add content
      const content = createContent(selectedContent, scene)
      contentRef.current = content
      anchor.group.add(content)
      
      // Target detection events
      anchor.onTargetFound = () => {
        setTargetFound(true)
      }
      
      anchor.onTargetLost = () => {
        setTargetFound(false)
      }

      setLoadingProgress('Ready!')
      return true
    } catch (err) {
      console.error('AR init failed:', err)
      setError('Failed to initialize AR. Please check camera permissions.')
      return false
    }
  }, [createContent, selectedContent])

  // Start AR session
  const startAR = useCallback(async () => {
    if (!mindarRef.current) {
      const ready = await initAR()
      if (!ready) return
    }
    
    try {
      setLoadingProgress('Starting camera...')
      await mindarRef.current!.start()
      
      // Start render loop
      const animate = () => {
        if (!mindarRef.current) return
        
        const time = performance.now() / 1000
        
        // Animate content
        if (contentRef.current?.userData.animate) {
          contentRef.current.userData.animate(time)
        }
        
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
  }, [initAR])

  // Stop AR session
  const stopAR = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    
    if (mindarRef.current) {
      mindarRef.current.stop()
      mindarRef.current = null
    }
    
    contentRef.current = null
    setIsRunning(false)
    setTargetFound(false)
  }, [])

  // Change content type
  const changeContent = useCallback((contentId: string) => {
    setSelectedContent(contentId)
    if (isRunning) {
      stopAR()
    }
  }, [isRunning, stopAR])

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
      
      setIsLoading(false)
    }
    
    init()
    
    return () => {
      mounted = false
      stopAR()
    }
  }, [loadMindAR, stopAR])

  return (
    <div className="experiment-page image-tracking-page">
      <header className="experiment-header">
        <Link to="/" className="back-link">← Back</Link>
        <div>
          <h1>Image Tracking</h1>
          <p>Recognize images and overlay 3D content</p>
        </div>
      </header>

      <div className="ar-container-wrapper">
        <div 
          ref={containerRef} 
          className={`ar-container ${isRunning ? 'active' : ''} ${targetFound ? 'tracking' : ''}`}
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
          
          {isRunning && (
            <div className="tracking-indicator">
              {targetFound ? (
                <span className="tracking-found">✓ Target Found</span>
              ) : (
                <span className="tracking-searching">🔍 Searching for target...</span>
              )}
            </div>
          )}
        </div>

        {isRunning && (
          <button onClick={stopAR} className="stop-button">
            ⏹ Stop
          </button>
        )}
      </div>

      <div className="content-section">
        <h2>3D Content</h2>
        <p className="section-desc">Select what appears when an image is detected:</p>
        <div className="content-grid">
          {CONTENT_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={`content-button ${selectedContent === option.id ? 'active' : ''}`}
              onClick={() => changeContent(option.id)}
            >
              <span className="content-emoji">{option.emoji}</span>
              <span className="content-name">{option.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="target-section">
        <h2>📎 Print a Target Image</h2>
        <p>Image tracking requires a physical image to detect. Print or display one of these targets:</p>
        <div className="target-images">
          <a 
            href="https://cdn.jsdelivr.net/gh/nicolo-rancan/AR-mind-file-targets@main/musicband-cover.png" 
            target="_blank" 
            rel="noopener noreferrer"
            className="target-link"
          >
            <img 
              src="https://cdn.jsdelivr.net/gh/nicolo-rancan/AR-mind-file-targets@main/musicband-cover.png" 
              alt="Target 1" 
              className="target-preview"
            />
            <span>Target Image 1</span>
          </a>
          <a 
            href="https://cdn.jsdelivr.net/gh/nicolo-rancan/AR-mind-file-targets@main/musicband-cover-2.png" 
            target="_blank" 
            rel="noopener noreferrer"
            className="target-link"
          >
            <img 
              src="https://cdn.jsdelivr.net/gh/nicolo-rancan/AR-mind-file-targets@main/musicband-cover-2.png" 
              alt="Target 2" 
              className="target-preview"
            />
            <span>Target Image 2</span>
          </a>
        </div>
        <p className="target-tip">💡 Tip: Open the image on another screen or print it for best results</p>
      </div>

      <section className="info-section">
        <h2>How It Works</h2>
        <ul>
          <li>
            <strong>MindAR.js</strong> — Open-source image tracking library
          </li>
          <li>
            <strong>NFT (Natural Feature Tracking)</strong> — Detects natural image features
          </li>
          <li>
            <strong>.mind files</strong> — Pre-compiled image data for fast detection
          </li>
          <li>
            <strong>Three.js</strong> — 3D content rendering
          </li>
        </ul>
        
        <h2>Creating Custom Targets</h2>
        <ul>
          <li><strong>Image Compiler</strong> — Use MindAR's online tool to create .mind files</li>
          <li><strong>Best images</strong> — High contrast, unique patterns, no repetition</li>
          <li><strong>Avoid</strong> — Solid colors, simple shapes, reflective surfaces</li>
          <li><strong>Size</strong> — Larger printed targets work better at distance</li>
        </ul>
        
        <h2>Use Cases</h2>
        <ul>
          <li>Product packaging with AR content</li>
          <li>Museum exhibits and art installations</li>
          <li>Educational materials with interactive 3D</li>
          <li>Business cards with AR portfolios</li>
          <li>Book covers that come to life</li>
        </ul>
      </section>
    </div>
  )
}
