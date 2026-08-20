import ThreeDCanvasBackground from "./ThreeDCanvasBackground";

interface AnimatedBackgroundProps {
  particleColor?: number;
  secondaryColor?: number;
}

export default function AnimatedBackground({
  particleColor = 0x6366f1,
  secondaryColor = 0x06b6d4,
}: AnimatedBackgroundProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Three.js Interactive 3D Particle Cloud & Shapes */}
      <ThreeDCanvasBackground
        particleColor={particleColor}
        secondaryColor={secondaryColor}
      />

      {/* GPU Animated Mesh Ambient Blobs */}
      <div className="animate-blob absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-blue-600/15 via-indigo-600/10 to-cyan-500/10 blur-[120px]" />
      <div className="animate-blob animation-delay-2000 absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-purple-600/15 via-pink-600/10 to-blue-500/10 blur-[120px]" />
      <div className="animate-blob animation-delay-4000 absolute -bottom-40 left-1/4 h-[30rem] w-[30rem] rounded-full bg-gradient-to-br from-emerald-600/10 via-cyan-600/10 to-indigo-600/10 blur-[120px]" />
    </div>
  );
}
