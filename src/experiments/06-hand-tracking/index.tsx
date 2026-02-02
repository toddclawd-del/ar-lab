/**
 * Experiment 06: Hand Tracking
 * 
 * Uses MediaPipe HandLandmarker to:
 * - Detect hands in real-time via webcam
 * - Track 21 hand landmarks per hand
 * - Recognize gestures (open palm, fist, pointing, thumbs up, pinch, peace)
 * - Enable air drawing with pinch gesture
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  FilesetResolver,
  HandLandmarker,
} from '@mediapipe/tasks-vision'
import type {
  HandLandmarkerResult,
  NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import './styles.css'

// Hand landmark indices
const LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
}

// Finger connections for drawing skeleton
const FINGER_CONNECTIONS = [
  // Thumb
  [LANDMARKS.WRIST, LANDMARKS.THUMB_CMC],
  [LANDMARKS.THUMB_CMC, LANDMARKS.THUMB_MCP],
  [LANDMARKS.THUMB_MCP, LANDMARKS.THUMB_IP],
  [LANDMARKS.THUMB_IP, LANDMARKS.THUMB_TIP],
  // Index
  [LANDMARKS.WRIST, LANDMARKS.INDEX_MCP],
  [LANDMARKS.INDEX_MCP, LANDMARKS.INDEX_PIP],
  [LANDMARKS.INDEX_PIP, LANDMARKS.INDEX_DIP],
  [LANDMARKS.INDEX_DIP, LANDMARKS.INDEX_TIP],
  // Middle
  [LANDMARKS.WRIST, LANDMARKS.MIDDLE_MCP],
  [LANDMARKS.MIDDLE_MCP, LANDMARKS.MIDDLE_PIP],
  [LANDMARKS.MIDDLE_PIP, LANDMARKS.MIDDLE_DIP],
  [LANDMARKS.MIDDLE_DIP, LANDMARKS.MIDDLE_TIP],
  // Ring
  [LANDMARKS.WRIST, LANDMARKS.RING_MCP],
  [LANDMARKS.RING_MCP, LANDMARKS.RING_PIP],
  [LANDMARKS.RING_PIP, LANDMARKS.RING_DIP],
  [LANDMARKS.RING_DIP, LANDMARKS.RING_TIP],
  // Pinky
  [LANDMARKS.WRIST, LANDMARKS.PINKY_MCP],
  [LANDMARKS.PINKY_MCP, LANDMARKS.PINKY_PIP],
  [LANDMARKS.PINKY_PIP, LANDMARKS.PINKY_DIP],
  [LANDMARKS.PINKY_DIP, LANDMARKS.PINKY_TIP],
  // Palm connections
  [LANDMARKS.INDEX_MCP, LANDMARKS.MIDDLE_MCP],
  [LANDMARKS.MIDDLE_MCP, LANDMARKS.RING_MCP],
  [LANDMARKS.RING_MCP, LANDMARKS.PINKY_MCP],
]

// Gesture types
type Gesture = 'open_palm' | 'fist' | 'pointing' | 'thumbs_up' | 'pinch' | 'peace' | 'unknown'

interface GestureInfo {
  name: string
  emoji: string
  description: string
}

const GESTURES: Record<Gesture, GestureInfo> = {
  open_palm: { name: 'Open Palm', emoji: '🖐️', description: 'All fingers extended' },
  fist: { name: 'Fist', emoji: '✊', description: 'All fingers closed' },
  pointing: { name: 'Pointing', emoji: '👆', description: 'Index finger up' },
  thumbs_up: { name: 'Thumbs Up', emoji: '👍', description: 'Thumb extended up' },
  pinch: { name: 'Pinch', emoji: '🤏', description: 'Thumb + index touching' },
  peace: { name: 'Peace', emoji: '✌️', description: 'Index + middle up' },
  unknown: { name: 'Unknown', emoji: '❓', description: 'Gesture not recognized' },
}

// Drawing stroke
interface Stroke {
  points: { x: number; y: number }[]
  color: string
}

// Utility functions for gesture detection
function distance(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  return Math.sqrt(dx * dx + dy * dy)
}

function isFingerExtended(
  landmarks: NormalizedLandmark[],
  tipIdx: number,
  pipIdx: number,
  mcpIdx: number
): boolean {
  const tip = landmarks[tipIdx]
  const pip = landmarks[pipIdx]
  const mcp = landmarks[mcpIdx]
  
  // Finger is extended if tip is further from palm than pip
  // Using y coordinate (lower y = higher on screen = extended)
  return tip.y < pip.y && pip.y < mcp.y
}

function isThumbExtended(landmarks: NormalizedLandmark[], isRightHand: boolean): boolean {
  const thumbTip = landmarks[LANDMARKS.THUMB_TIP]
  const thumbIP = landmarks[LANDMARKS.THUMB_IP]
  const thumbMCP = landmarks[LANDMARKS.THUMB_MCP]
  
  // Thumb extends outward (x-axis dependent on handedness)
  if (isRightHand) {
    return thumbTip.x < thumbIP.x && thumbIP.x < thumbMCP.x
  } else {
    return thumbTip.x > thumbIP.x && thumbIP.x > thumbMCP.x
  }
}

function detectGesture(landmarks: NormalizedLandmark[], isRightHand: boolean): Gesture {
  const thumbExtended = isThumbExtended(landmarks, isRightHand)
  const indexExtended = isFingerExtended(
    landmarks,
    LANDMARKS.INDEX_TIP,
    LANDMARKS.INDEX_PIP,
    LANDMARKS.INDEX_MCP
  )
  const middleExtended = isFingerExtended(
    landmarks,
    LANDMARKS.MIDDLE_TIP,
    LANDMARKS.MIDDLE_PIP,
    LANDMARKS.MIDDLE_MCP
  )
  const ringExtended = isFingerExtended(
    landmarks,
    LANDMARKS.RING_TIP,
    LANDMARKS.RING_PIP,
    LANDMARKS.RING_MCP
  )
  const pinkyExtended = isFingerExtended(
    landmarks,
    LANDMARKS.PINKY_TIP,
    LANDMARKS.PINKY_PIP,
    LANDMARKS.PINKY_MCP
  )
  
  // Check for pinch (thumb and index tips close together)
  const pinchDistance = distance(
    landmarks[LANDMARKS.THUMB_TIP],
    landmarks[LANDMARKS.INDEX_TIP]
  )
  const isPinching = pinchDistance < 0.05
  
  if (isPinching) return 'pinch'
  
  // Thumbs up: thumb extended, all others closed
  if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return 'thumbs_up'
  }
  
  // Open palm: all fingers extended
  if (thumbExtended && indexExtended && middleExtended && ringExtended && pinkyExtended) {
    return 'open_palm'
  }
  
  // Fist: all fingers closed
  if (!thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return 'fist'
  }
  
  // Pointing: only index extended
  if (!thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return 'pointing'
  }
  
  // Peace: index and middle extended, others closed
  if (!thumbExtended && indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
    return 'peace'
  }
  
  return 'unknown'
}

// Color palette for drawing
const COLORS = ['#06b6d4', '#8b5cf6', '#f43f5e', '#22c55e', '#f59e0b', '#ec4899']

export default function HandTrackingExperiment() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const animationRef = useRef<number | null>(null)
  const lastVideoTimeRef = useRef(-1)
  const strokesRef = useRef<Stroke[]>([])
  const currentStrokeRef = useRef<Stroke | null>(null)
  const wasPinchingRef = useRef(false)
  
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingProgress, setLoadingProgress] = useState('Initializing...')
  const [detectedGestures, setDetectedGestures] = useState<Map<string, Gesture>>(new Map())
  const [handCount, setHandCount] = useState(0)
  const [drawMode, setDrawMode] = useState(true)
  const [currentColor, setCurrentColor] = useState(COLORS[0])

  // Initialize HandLandmarker
  const initHandLandmarker = useCallback(async () => {
    try {
      setLoadingProgress('Loading MediaPipe...')
      
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      )
      
      setLoadingProgress('Creating hand detector...')
      
      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
      
      handLandmarkerRef.current = handLandmarker
      setLoadingProgress('Ready!')
      return true
    } catch (err) {
      console.error('Failed to initialize HandLandmarker:', err)
      setError('Failed to load hand tracking model. Please check your internet connection.')
      return false
    }
  }, [])

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setLoadingProgress('Starting camera...')
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await new Promise<void>((resolve) => {
          videoRef.current!.onloadedmetadata = () => {
            videoRef.current!.play()
            resolve()
          }
        })
        
        // Size canvases to match video
        if (canvasRef.current && drawCanvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth
          canvasRef.current.height = videoRef.current.videoHeight
          drawCanvasRef.current.width = videoRef.current.videoWidth
          drawCanvasRef.current.height = videoRef.current.videoHeight
        }
      }
      
      return true
    } catch (err) {
      console.error('Failed to start camera:', err)
      setError('Failed to access camera. Please grant camera permission.')
      return false
    }
  }, [])

  // Draw hand landmarks on canvas
  const drawLandmarks = useCallback(
    (ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[], handedness: string) => {
      const width = canvasRef.current?.width || 640
      const height = canvasRef.current?.height || 480
      
      const isRightHand = handedness === 'Right'
      const color = isRightHand ? '#06b6d4' : '#8b5cf6'
      
      // Draw connections
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      
      FINGER_CONNECTIONS.forEach(([start, end]) => {
        const startLandmark = landmarks[start]
        const endLandmark = landmarks[end]
        
        ctx.beginPath()
        ctx.moveTo(startLandmark.x * width, startLandmark.y * height)
        ctx.lineTo(endLandmark.x * width, endLandmark.y * height)
        ctx.stroke()
      })
      
      // Draw landmark points
      landmarks.forEach((landmark, index) => {
        const x = landmark.x * width
        const y = landmark.y * height
        
        // Larger circle for fingertips
        const isTip = [4, 8, 12, 16, 20].includes(index)
        const radius = isTip ? 8 : 5
        
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, 2 * Math.PI)
        ctx.fillStyle = isTip ? '#ffffff' : color
        ctx.fill()
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.stroke()
      })
    },
    []
  )

  // Draw strokes on drawing canvas
  const drawStrokes = useCallback(() => {
    const ctx = drawCanvasRef.current?.getContext('2d')
    if (!ctx || !drawCanvasRef.current) return
    
    // Clear and redraw all strokes
    ctx.clearRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height)
    
    const allStrokes = [...strokesRef.current]
    if (currentStrokeRef.current) {
      allStrokes.push(currentStrokeRef.current)
    }
    
    allStrokes.forEach((stroke) => {
      if (stroke.points.length < 2) return
      
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      
      ctx.stroke()
    })
  }, [])

  // Process video frame
  const processFrame = useCallback(() => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !handLandmarkerRef.current ||
      videoRef.current.currentTime === lastVideoTimeRef.current
    ) {
      animationRef.current = requestAnimationFrame(processFrame)
      return
    }
    
    lastVideoTimeRef.current = videoRef.current.currentTime
    
    const results: HandLandmarkerResult = handLandmarkerRef.current.detectForVideo(
      videoRef.current,
      performance.now()
    )
    
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) {
      animationRef.current = requestAnimationFrame(processFrame)
      return
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    
    // Update hand count
    setHandCount(results.landmarks.length)
    
    // Process each hand
    const newGestures = new Map<string, Gesture>()
    let isPinching = false
    let pinchPosition: { x: number; y: number } | null = null
    
    results.landmarks.forEach((landmarks, index) => {
      const handedness = results.handednesses[index]?.[0]?.categoryName || 'Unknown'
      const isRightHand = handedness === 'Right'
      
      // Draw landmarks
      drawLandmarks(ctx, landmarks, handedness)
      
      // Detect gesture
      const gesture = detectGesture(landmarks, isRightHand)
      newGestures.set(handedness, gesture)
      
      // Check for pinch (for drawing)
      if (gesture === 'pinch' && drawMode) {
        isPinching = true
        const thumbTip = landmarks[LANDMARKS.THUMB_TIP]
        const indexTip = landmarks[LANDMARKS.INDEX_TIP]
        pinchPosition = {
          x: ((thumbTip.x + indexTip.x) / 2) * canvasRef.current!.width,
          y: ((thumbTip.y + indexTip.y) / 2) * canvasRef.current!.height,
        }
      }
    })
    
    setDetectedGestures(newGestures)
    
    // Handle drawing
    if (drawMode) {
      if (isPinching && pinchPosition) {
        if (!wasPinchingRef.current) {
          // Start new stroke
          currentStrokeRef.current = {
            points: [pinchPosition],
            color: currentColor,
          }
        } else if (currentStrokeRef.current) {
          // Continue stroke
          currentStrokeRef.current.points.push(pinchPosition)
        }
      } else if (wasPinchingRef.current && currentStrokeRef.current) {
        // End stroke
        if (currentStrokeRef.current.points.length > 1) {
          strokesRef.current.push(currentStrokeRef.current)
        }
        currentStrokeRef.current = null
      }
      
      wasPinchingRef.current = isPinching
      drawStrokes()
    }
    
    animationRef.current = requestAnimationFrame(processFrame)
  }, [drawLandmarks, drawStrokes, drawMode, currentColor])

  // Start tracking
  const startTracking = useCallback(async () => {
    const cameraReady = await startCamera()
    if (!cameraReady) {
      setIsLoading(false)
      return
    }
    
    setIsRunning(true)
    setIsLoading(false)
    
    // Start processing loop
    animationRef.current = requestAnimationFrame(processFrame)
  }, [startCamera, processFrame])

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    
    setIsRunning(false)
  }, [])

  // Clear drawing
  const clearDrawing = useCallback(() => {
    strokesRef.current = []
    currentStrokeRef.current = null
    wasPinchingRef.current = false
    
    const ctx = drawCanvasRef.current?.getContext('2d')
    if (ctx && drawCanvasRef.current) {
      ctx.clearRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height)
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    let mounted = true
    
    const init = async () => {
      const ready = await initHandLandmarker()
      if (!mounted) return
      
      if (ready) {
        setIsLoading(false)
      }
    }
    
    init()
    
    return () => {
      mounted = false
      stopTracking()
      handLandmarkerRef.current?.close()
    }
  }, [initHandLandmarker, stopTracking])

  return (
    <div className="experiment-page hand-tracking-page">
      <header className="experiment-header">
        <Link to="/" className="back-link">← Back</Link>
        <div>
          <h1>Hand Tracking</h1>
          <p>MediaPipe hand detection & gesture recognition</p>
        </div>
      </header>

      <div className="ar-container-wrapper">
        <div className={`ar-container ${isRunning ? 'active' : ''}`}>
          <video
            ref={videoRef}
            className="video-feed"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="landmarks-canvas" />
          <canvas ref={drawCanvasRef} className="draw-canvas" />
          
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
              <button onClick={startTracking} className="start-button">
                🖐️ Start Tracking
              </button>
              <p className="permission-note">
                Requires camera permission
              </p>
            </div>
          )}
          
          {isRunning && (
            <div className="status-overlay">
              <div className="hand-count">
                {handCount === 0 ? '👋 Show your hands!' : `${handCount} hand${handCount > 1 ? 's' : ''} detected`}
              </div>
              {Array.from(detectedGestures.entries()).map(([hand, gesture]) => (
                <div key={hand} className="gesture-display">
                  <span className="hand-label">{hand}:</span>
                  <span className="gesture-emoji">{GESTURES[gesture].emoji}</span>
                  <span className="gesture-name">{GESTURES[gesture].name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {isRunning && (
          <div className="controls-bar">
            <button onClick={stopTracking} className="control-button stop">
              ⏹ Stop
            </button>
            <button
              onClick={() => setDrawMode(!drawMode)}
              className={`control-button ${drawMode ? 'active' : ''}`}
            >
              {drawMode ? '🖊️ Draw ON' : '🖊️ Draw OFF'}
            </button>
            {drawMode && (
              <button onClick={clearDrawing} className="control-button">
                🗑️ Clear
              </button>
            )}
          </div>
        )}
      </div>

      {isRunning && drawMode && (
        <div className="color-picker">
          <h3>Drawing Color</h3>
          <div className="color-options">
            {COLORS.map((color) => (
              <button
                key={color}
                className={`color-swatch ${currentColor === color ? 'active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setCurrentColor(color)}
              />
            ))}
          </div>
          <p className="color-hint">Pinch 🤏 to draw in the air!</p>
        </div>
      )}

      <section className="gestures-section">
        <h2>Recognized Gestures</h2>
        <div className="gestures-grid">
          {Object.entries(GESTURES)
            .filter(([key]) => key !== 'unknown')
            .map(([key, info]) => (
              <div key={key} className="gesture-card">
                <span className="gesture-card-emoji">{info.emoji}</span>
                <span className="gesture-card-name">{info.name}</span>
                <span className="gesture-card-desc">{info.description}</span>
              </div>
            ))}
        </div>
      </section>

      <section className="info-section">
        <h2>How It Works</h2>
        <ul>
          <li>
            <strong>MediaPipe HandLandmarker</strong> — Google's ML hand detection model
          </li>
          <li>
            <strong>21 Landmarks</strong> — Tracks all finger joints and wrist
          </li>
          <li>
            <strong>Gesture Recognition</strong> — Custom logic using landmark positions
          </li>
          <li>
            <strong>WebGL Acceleration</strong> — GPU-powered inference for real-time tracking
          </li>
        </ul>
        
        <h2>Hand Landmarks</h2>
        <ul>
          <li><strong>Wrist (0)</strong> — Base reference point</li>
          <li><strong>Thumb (1-4)</strong> — CMC, MCP, IP, Tip</li>
          <li><strong>Index (5-8)</strong> — MCP, PIP, DIP, Tip</li>
          <li><strong>Middle (9-12)</strong> — MCP, PIP, DIP, Tip</li>
          <li><strong>Ring (13-16)</strong> — MCP, PIP, DIP, Tip</li>
          <li><strong>Pinky (17-20)</strong> — MCP, PIP, DIP, Tip</li>
        </ul>
        
        <h2>Browser Requirements</h2>
        <ul>
          <li><strong>Chrome / Edge / Safari</strong> — Modern browsers with WebGL</li>
          <li><strong>Camera permission</strong> — Required for video input</li>
          <li><strong>HTTPS</strong> — Required for camera access</li>
          <li><strong>GPU recommended</strong> — For smooth real-time tracking</li>
        </ul>
        
        <h2>Use Cases</h2>
        <ul>
          <li>Sign language recognition</li>
          <li>Touchless UI control</li>
          <li>Virtual instrument playing</li>
          <li>AR/VR hand interaction</li>
          <li>Accessibility tools</li>
          <li>Gesture-based gaming</li>
        </ul>
      </section>
    </div>
  )
}
