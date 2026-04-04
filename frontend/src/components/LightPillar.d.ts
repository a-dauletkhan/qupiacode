declare const LightPillar: React.FC<{
  topColor?: string
  bottomColor?: string
  intensity?: number
  rotationSpeed?: number
  interactive?: boolean
  className?: string
  glowAmount?: number
  pillarWidth?: number
  pillarHeight?: number
  noiseIntensity?: number
  mixBlendMode?: string
  pillarRotation?: number
  quality?: "low" | "medium" | "high"
}>

export default LightPillar
