/**
 * Experiment 07: Body Tracking
 * 
 * Uses MediaPipe PoseLandmarker to:
 * - Detect full body poses in real-time via webcam
 * - Track 33 body landmarks per person
 * - Recognize basic poses (standing, sitting, arms raised, T-pose, etc.)
 * - Support multiple person detection
 * - Calculate joint angles for fitness/posture analysis
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  FilesetResolver,
  PoseLandmarker,
} from '@mediapipe/tasks-vision'
import type {
  PoseLandmarkerResult,
  NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import './styles.css'

// Body landmark indices (33 points)
const LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
}

// Skeleton connections for drawing
const SKELETON_CONNECTIONS = [
  // Face
  [LANDMARKS.LEFT_EAR, LANDMARKS.LEFT_EYE_OUTER],
  [LANDMARKS.LEFT_EYE_OUTER, LANDMARKS.LEFT_EYE],
  [LANDMARKS.LEFT_EYE, LANDMARKS.LEFT_EYE_INNER],
  [LANDMARKS.LEFT_EYE_INNER, LANDMARKS.NOSE],
  [LANDMARKS.NOSE, LANDMARKS.RIGHT_EYE_INNER],
  [LANDMARKS.RIGHT_EYE_INNER, LANDMARKS.RIGHT_EYE],
  [LANDMARKS.RIGHT_EYE, LANDMARKS.RIGHT_EYE_OUTER],
  [LANDMARKS.RIGHT_EYE_OUTER, LANDMARKS.RIGHT_EAR],
  [LANDMARKS.MOUTH_LEFT, LANDMARKS.MOUTH_RIGHT],
  
  // Torso
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP],
  [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP],
  [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
  
  // Left arm
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW],
  [LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST],
  [LANDMARKS.LEFT_WRIST, LANDMARKS.LEFT_PINKY],
  [LANDMARKS.LEFT_WRIST, LANDMARKS.LEFT_INDEX],
  [LANDMARKS.LEFT_WRIST, LANDMARKS.LEFT_THUMB],
  [LANDMARKS.LEFT_PINKY, LANDMARKS.LEFT_INDEX],
  
  // Right arm
  [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW],
  [LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST],
  [LANDMARKS.RIGHT_WRIST, LANDMARKS.RIGHT_PINKY],
  [LANDMARKS.RIGHT_WRIST, LANDMARKS.RIGHT_INDEX],
  [LANDMARKS.RIGHT_WRIST, LANDMARKS.RIGHT_THUMB],
  [LANDMARKS.RIGHT_PINKY, LANDMARKS.RIGHT_INDEX],
  
  // Left leg
  [LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE],
  [LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE],
  [LANDMARKS.LEFT_ANKLE, LANDMARKS.LEFT_HEEL],
  [LANDMARKS.LEFT_ANKLE, LANDMARKS.LEFT_FOOT_INDEX],
  [LANDMARKS.LEFT_HEEL, LANDMARKS.LEFT_FOOT_INDEX],
  
  // Right leg
  [LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE],
  [LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE],
  [LANDMARKS.RIGHT_ANKLE, LANDMARKS.RIGHT_HEEL],
  [LANDMARKS.RIGHT_ANKLE, LANDMARKS.RIGHT_FOOT_INDEX],
  [LANDMARKS.RIGHT_HEEL, LANDMARKS.RIGHT_FOOT_INDEX],
]

// Pose types
type Pose = 'standing' | 't_pose' | 'arms_up' | 'hands_on_hips' | 'sitting' | 'leaning' | 'unknown'

interface PoseInfo {
  name: string
  emoji: string
  description: string
}

const POSES: Record<Pose, PoseInfo> = {
  standing: { name: 'Standing', emoji: '🧍', description: 'Upright neutral position' },
  t_pose: { name: 'T-Pose', emoji: '✝️', description: 'Arms extended horizontally' },
  arms_up: { name: 'Arms Up', emoji: '🙌', description: 'Both arms raised overhead' },
  hands_on_hips: { name: 'Hands on Hips', emoji: '💁', description: 'Arms bent, hands at waist' },
  sitting: { name: 'Sitting', emoji: '🪑', description: 'Seated or crouching position' },
  leaning: { name: 'Leaning', emoji: '↗️', description: 'Body tilted to one side' },
  unknown: { name: 'Unknown', emoji: '❓', description: 'Pose not recognized' },
}

// Person colors for multi-person tracking
const PERSON_COLORS = ['#06b6d4', '#8b5cf6', '#f43f5e', '#22c55e', '#f59e0b', '#ec4899']

// Utility: Calculate angle between three points
function calculateAngle(
  a: NormalizedLandmark,
  b: NormalizedLandmark, // vertex
  c: NormalizedLandmark
): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  let angle = Math.abs((radians * 180) / Math.PI)
  if (angle > 180) angle = 360 - angle
  return angle
}

// Utility: Calculate distance between two points
function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

// Utility: Check if landmark is visible enough
function isVisible(landmark: NormalizedLandmark, threshold = 0.5): boolean {
  return (landmark.visibility ?? 0) > threshold
}

// Detect pose from landmarks
function detectPose(landmarks: NormalizedLandmark[]): Pose {
  const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER]
  const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER]
  const leftElbow = landmarks[LANDMARKS.LEFT_ELBOW]
  const rightElbow = landmarks[LANDMARKS.RIGHT_ELBOW]
  const leftWrist = landmarks[LANDMARKS.LEFT_WRIST]
  const rightWrist = landmarks[LANDMARKS.RIGHT_WRIST]
  const leftHip = landmarks[LANDMARKS.LEFT_HIP]
  const rightHip = landmarks[LANDMARKS.RIGHT_HIP]
  const leftKnee = landmarks[LANDMARKS.LEFT_KNEE]
  const rightKnee = landmarks[LANDMARKS.RIGHT_KNEE]
  
  // Check visibility of key landmarks
  const upperBodyVisible = isVisible(leftShoulder) && isVisible(rightShoulder) &&
                          isVisible(leftHip) && isVisible(rightHip)
  
  if (!upperBodyVisible) return 'unknown'
  
  // Calculate key angles
  const leftArmAngle = calculateAngle(leftShoulder, leftElbow, leftWrist)
  const rightArmAngle = calculateAngle(rightShoulder, rightElbow, rightWrist)
  const leftShoulderAngle = calculateAngle(leftHip, leftShoulder, leftElbow)
  const rightShoulderAngle = calculateAngle(rightHip, rightShoulder, rightElbow)
  const leftKneeAngle = isVisible(leftKnee) ? calculateAngle(leftHip, leftKnee, landmarks[LANDMARKS.LEFT_ANKLE]) : 180
  const rightKneeAngle = isVisible(rightKnee) ? calculateAngle(rightHip, rightKnee, landmarks[LANDMARKS.RIGHT_ANKLE]) : 180
  
  // Calculate torso tilt
  const shoulderCenter = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 }
  const hipCenter = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 }
  const torsoTilt = Math.abs(shoulderCenter.x - hipCenter.x) / distance(leftShoulder, rightShoulder)
  
  // Arms up: both wrists above shoulders
  if (leftWrist.y < leftShoulder.y - 0.1 && rightWrist.y < rightShoulder.y - 0.1) {
    // Check if arms are mostly straight up
    if (leftShoulderAngle > 150 && rightShoulderAngle > 150) {
      return 'arms_up'
    }
  }
  
  // T-Pose: arms extended horizontally
  if (leftShoulderAngle > 70 && leftShoulderAngle < 110 &&
      rightShoulderAngle > 70 && rightShoulderAngle < 110 &&
      leftArmAngle > 150 && rightArmAngle > 150) {
    const leftWristLevel = Math.abs(leftWrist.y - leftShoulder.y)
    const rightWristLevel = Math.abs(rightWrist.y - rightShoulder.y)
    if (leftWristLevel < 0.15 && rightWristLevel < 0.15) {
      return 't_pose'
    }
  }
  
  // Hands on hips: wrists near hips, elbows bent outward
  const leftWristNearHip = distance(leftWrist, leftHip) < 0.15
  const rightWristNearHip = distance(rightWrist, rightHip) < 0.15
  if (leftWristNearHip && rightWristNearHip &&
      leftArmAngle < 120 && rightArmAngle < 120) {
    return 'hands_on_hips'
  }
  
  // Sitting: knees significantly bent
  if (leftKneeAngle < 120 && rightKneeAngle < 120) {
    return 'sitting'
  }
  
  // Leaning: significant torso tilt
  if (torsoTilt > 0.3) {
    return 'leaning'
  }
  
  // Standing: relatively upright, legs straight
  if (leftKneeAngle > 150 && rightKneeAngle > 150 && torsoTilt < 0.2) {
    return 'standing'
  }
  
  return 'unknown'
}

// Calculate joint angles for analysis display
function calculateJointAngles(landmarks: NormalizedLandmark[]) {
  return {
    leftElbow: Math.round(calculateAngle(
      landmarks[LANDMARKS.LEFT_SHOULDER],
      landmarks[LANDMARKS.LEFT_ELBOW],
      landmarks[LANDMARKS.LEFT_WRIST]
    )),
    rightElbow: Math.round(calculateAngle(
      landmarks[LANDMARKS.RIGHT_SHOULDER],
      landmarks[LANDMARKS.RIGHT_ELBOW],
      landmarks[LANDMARKS.RIGHT_WRIST]
    )),
    leftKnee: Math.round(calculateAngle(
      landmarks[LANDMARKS.LEFT_HIP],
      landmarks[LANDMARKS.LEFT_KNEE],
      landmarks[LANDMARKS.LEFT_ANKLE]
    )),
    rightKnee: Math.round(calculateAngle(
      landmarks[LANDMARKS.RIGHT_HIP],
      landmarks[LANDMARKS.RIGHT_KNEE],
      landmarks[LANDMARKS.RIGHT_ANKLE]
    )),
    leftShoulder: Math.round(calculateAngle(
      landmarks[LANDMARKS.LEFT_HIP],
      landmarks[LANDMARKS.LEFT_SHOULDER],
      landmarks[LANDMARKS.LEFT_ELBOW]
    )),
    rightShoulder: Math.round(calculateAngle(
      landmarks[LANDMARKS.RIGHT_HIP],
      landmarks[LANDMARKS.RIGHT_SHOULDER],
      landmarks[LANDMARKS.RIGHT_ELBOW]
    )),
  }
}

export default function BodyTrackingExperiment() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null)
  const animationRef = useRef<number | null>(null)
  const lastVideoTimeRef = useRef(-1)
  
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingProgress, setLoadingProgress] = useState('Initializing...')
  const [poseCount, setPoseCount] = useState(0)
  const [detectedPoses, setDetectedPoses] = useState<Pose[]>([])
  const [jointAngles, setJointAngles] = useState<ReturnType<typeof calculateJointAngles> | null>(null)
  const [showAngles, setShowAngles] = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(true)

  // Initialize PoseLandmarker
  const initPoseLandmarker = useCallback(async () => {
    try {
      setLoadingProgress('Loading MediaPipe...')
      
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      )
      
      setLoadingProgress('Creating pose detector...')
      
      const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 3, // Track up to 3 people
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
      
      poseLandmarkerRef.current = poseLandmarker
      setLoadingProgress('Ready!')
      return true
    } catch (err) {
      console.error('Failed to initialize PoseLandmarker:', err)
      setError('Failed to load pose detection model. Please check your internet connection.')
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
        
        // Size canvas to match video
        if (canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth
          canvasRef.current.height = videoRef.current.videoHeight
        }
      }
      
      return true
    } catch (err) {
      console.error('Failed to start camera:', err)
      setError('Failed to access camera. Please grant camera permission.')
      return false
    }
  }, [])

  // Draw skeleton on canvas
  const drawSkeleton = useCallback(
    (ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[], color: string) => {
      const width = canvasRef.current?.width || 640
      const height = canvasRef.current?.height || 480
      
      if (!showSkeleton) return
      
      // Draw connections
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      
      SKELETON_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const start = landmarks[startIdx]
        const end = landmarks[endIdx]
        
        // Only draw if both landmarks are visible
        if ((start.visibility ?? 0) > 0.5 && (end.visibility ?? 0) > 0.5) {
          ctx.beginPath()
          ctx.moveTo(start.x * width, start.y * height)
          ctx.lineTo(end.x * width, end.y * height)
          ctx.stroke()
        }
      })
      
      // Draw landmark points
      landmarks.forEach((landmark, index) => {
        if ((landmark.visibility ?? 0) < 0.5) return
        
        const x = landmark.x * width
        const y = landmark.y * height
        
        // Larger circles for key joints
        const isKeyJoint = [
          LANDMARKS.NOSE,
          LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER,
          LANDMARKS.LEFT_ELBOW, LANDMARKS.RIGHT_ELBOW,
          LANDMARKS.LEFT_WRIST, LANDMARKS.RIGHT_WRIST,
          LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP,
          LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE,
          LANDMARKS.LEFT_ANKLE, LANDMARKS.RIGHT_ANKLE,
        ].includes(index)
        
        const radius = isKeyJoint ? 6 : 3
        
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, 2 * Math.PI)
        ctx.fillStyle = isKeyJoint ? '#ffffff' : color
        ctx.fill()
        if (isKeyJoint) {
          ctx.strokeStyle = color
          ctx.lineWidth = 2
          ctx.stroke()
        }
      })
      
      // Draw angles if enabled
      if (showAngles && landmarks.length >= 33) {
        ctx.font = '14px monospace'
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 3
        
        const angles = calculateJointAngles(landmarks)
        const anglePositions = [
          { angle: angles.leftElbow, landmark: landmarks[LANDMARKS.LEFT_ELBOW] },
          { angle: angles.rightElbow, landmark: landmarks[LANDMARKS.RIGHT_ELBOW] },
          { angle: angles.leftKnee, landmark: landmarks[LANDMARKS.LEFT_KNEE] },
          { angle: angles.rightKnee, landmark: landmarks[LANDMARKS.RIGHT_KNEE] },
        ]
        
        anglePositions.forEach(({ angle, landmark }) => {
          if ((landmark.visibility ?? 0) > 0.5) {
            const x = landmark.x * width + 10
            const y = landmark.y * height
            const text = `${angle}°`
            ctx.strokeText(text, x, y)
            ctx.fillText(text, x, y)
          }
        })
      }
    },
    [showSkeleton, showAngles]
  )

  // Process video frame
  const processFrame = useCallback(() => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !poseLandmarkerRef.current ||
      videoRef.current.currentTime === lastVideoTimeRef.current
    ) {
      animationRef.current = requestAnimationFrame(processFrame)
      return
    }
    
    lastVideoTimeRef.current = videoRef.current.currentTime
    
    const results: PoseLandmarkerResult = poseLandmarkerRef.current.detectForVideo(
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
    
    // Update pose count
    setPoseCount(results.landmarks.length)
    
    // Process each detected person
    const poses: Pose[] = []
    
    results.landmarks.forEach((landmarks, index) => {
      const color = PERSON_COLORS[index % PERSON_COLORS.length]
      
      // Draw skeleton
      drawSkeleton(ctx, landmarks, color)
      
      // Detect pose
      const pose = detectPose(landmarks)
      poses.push(pose)
      
      // Calculate joint angles for first person only
      if (index === 0) {
        setJointAngles(calculateJointAngles(landmarks))
      }
    })
    
    setDetectedPoses(poses)
    
    animationRef.current = requestAnimationFrame(processFrame)
  }, [drawSkeleton])

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
    setJointAngles(null)
    setDetectedPoses([])
  }, [])

  // Initialize on mount
  useEffect(() => {
    let mounted = true
    
    const init = async () => {
      const ready = await initPoseLandmarker()
      if (!mounted) return
      
      if (ready) {
        setIsLoading(false)
      }
    }
    
    init()
    
    return () => {
      mounted = false
      stopTracking()
      poseLandmarkerRef.current?.close()
    }
  }, [initPoseLandmarker, stopTracking])

  return (
    <div className="experiment-page body-tracking-page">
      <header className="experiment-header">
        <Link to="/" className="back-link">← Back</Link>
        <div>
          <h1>Body Tracking</h1>
          <p>MediaPipe full-body pose detection & analysis</p>
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
                🧍 Start Tracking
              </button>
              <p className="permission-note">
                Requires camera permission
              </p>
            </div>
          )}
          
          {isRunning && (
            <div className="status-overlay">
              <div className="pose-count">
                {poseCount === 0 
                  ? '👋 Step into frame!' 
                  : `${poseCount} ${poseCount === 1 ? 'person' : 'people'} detected`
                }
              </div>
              {detectedPoses.map((pose, index) => (
                <div key={index} className="pose-display" style={{ color: PERSON_COLORS[index] }}>
                  <span className="person-label">Person {index + 1}:</span>
                  <span className="pose-emoji">{POSES[pose].emoji}</span>
                  <span className="pose-name">{POSES[pose].name}</span>
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
              onClick={() => setShowSkeleton(!showSkeleton)}
              className={`control-button ${showSkeleton ? 'active' : ''}`}
            >
              {showSkeleton ? '🦴 Skeleton ON' : '🦴 Skeleton OFF'}
            </button>
            <button
              onClick={() => setShowAngles(!showAngles)}
              className={`control-button ${showAngles ? 'active' : ''}`}
            >
              {showAngles ? '📐 Angles ON' : '📐 Angles OFF'}
            </button>
          </div>
        )}
      </div>

      {isRunning && jointAngles && (
        <div className="angles-panel">
          <h3>Joint Angles (Person 1)</h3>
          <div className="angles-grid">
            <div className="angle-item">
              <span className="angle-label">L Shoulder</span>
              <span className="angle-value">{jointAngles.leftShoulder}°</span>
            </div>
            <div className="angle-item">
              <span className="angle-label">R Shoulder</span>
              <span className="angle-value">{jointAngles.rightShoulder}°</span>
            </div>
            <div className="angle-item">
              <span className="angle-label">L Elbow</span>
              <span className="angle-value">{jointAngles.leftElbow}°</span>
            </div>
            <div className="angle-item">
              <span className="angle-label">R Elbow</span>
              <span className="angle-value">{jointAngles.rightElbow}°</span>
            </div>
            <div className="angle-item">
              <span className="angle-label">L Knee</span>
              <span className="angle-value">{jointAngles.leftKnee}°</span>
            </div>
            <div className="angle-item">
              <span className="angle-label">R Knee</span>
              <span className="angle-value">{jointAngles.rightKnee}°</span>
            </div>
          </div>
        </div>
      )}

      <section className="poses-section">
        <h2>Recognized Poses</h2>
        <div className="poses-grid">
          {Object.entries(POSES)
            .filter(([key]) => key !== 'unknown')
            .map(([key, info]) => (
              <div key={key} className="pose-card">
                <span className="pose-card-emoji">{info.emoji}</span>
                <span className="pose-card-name">{info.name}</span>
                <span className="pose-card-desc">{info.description}</span>
              </div>
            ))}
        </div>
      </section>

      <section className="info-section">
        <h2>How It Works</h2>
        <ul>
          <li>
            <strong>MediaPipe PoseLandmarker</strong> — Google's ML body detection model
          </li>
          <li>
            <strong>33 Landmarks</strong> — Tracks full body from face to feet
          </li>
          <li>
            <strong>Multi-Person</strong> — Detects up to 3 people simultaneously
          </li>
          <li>
            <strong>Joint Angles</strong> — Real-time angle calculation for analysis
          </li>
          <li>
            <strong>3D Coordinates</strong> — Depth estimation for each landmark
          </li>
        </ul>
        
        <h2>Body Landmarks (33 Points)</h2>
        <ul>
          <li><strong>Face (0-10)</strong> — Nose, eyes, ears, mouth</li>
          <li><strong>Upper Body (11-22)</strong> — Shoulders, elbows, wrists, hands</li>
          <li><strong>Lower Body (23-32)</strong> — Hips, knees, ankles, feet</li>
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
          <li>Fitness & workout tracking</li>
          <li>Posture analysis & correction</li>
          <li>Physical therapy exercises</li>
          <li>Dance & movement training</li>
          <li>Sports performance analysis</li>
          <li>Gesture-based gaming</li>
          <li>Motion capture for animation</li>
        </ul>
      </section>
    </div>
  )
}
