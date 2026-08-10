import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeDCanvasBackgroundProps {
  particleColor?: number;
  secondaryColor?: number;
  density?: number;
}

export default function ThreeDCanvasBackground({
  particleColor = 0x6366f1, // Indigo
  secondaryColor = 0x06b6d4, // Cyan
  density = 1500,
}: ThreeDCanvasBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL availability
    let canvas: HTMLCanvasElement;
    try {
      canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return;
    } catch {
      return;
    }

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 400;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Create 3D Particle Constellation System
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(density * 3);
    const colors = new Float32Array(density * 3);
    const sizes = new Float32Array(density);

    const color1 = new THREE.Color(particleColor);
    const color2 = new THREE.Color(secondaryColor);
    const color3 = new THREE.Color(0xa855f7); // Purple accent

    for (let i = 0; i < density; i++) {
      const i3 = i * 3;
      // Distribute in a spherical cloud around origin
      const radius = 250 + Math.random() * 350;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      // Interpolate colors
      const mixRatio = Math.random();
      const mixedColor = mixRatio < 0.5 ? color1.clone().lerp(color2, mixRatio * 2) : color2.clone().lerp(color3, (mixRatio - 0.5) * 2);

      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;

      sizes[i] = Math.random() * 3.5 + 1.2;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Custom Particle Material with smooth circular point sprite
    const canvasPoint = document.createElement("canvas");
    canvasPoint.width = 16;
    canvasPoint.height = 16;
    const ctxPoint = canvasPoint.getContext("2d")!;
    const grad = ctxPoint.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, "rgba(255, 255, 255, 1)");
    grad.addColorStop(0.4, "rgba(255, 255, 255, 0.6)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctxPoint.fillStyle = grad;
    ctxPoint.fillRect(0, 0, 16, 16);

    const texture = new THREE.CanvasTexture(canvasPoint);

    const material = new THREE.PointsMaterial({
      size: 4.5,
      vertexColors: true,
      map: texture,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    // Create 3D Wireframe Floating Torus Knot
    const knotGeometry = new THREE.TorusKnotGeometry(120, 30, 120, 16, 2, 3);
    const knotMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    });
    const torusKnot = new THREE.Mesh(knotGeometry, knotMaterial);
    scene.add(torusKnot);

    // Create secondary floating geometric ring
    const ringGeometry = new THREE.RingGeometry(180, 184, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.12,
      wireframe: true,
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh.rotation.x = Math.PI / 3;
    scene.add(ringMesh);

    // Mouse Parallax Event
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX - window.innerWidth / 2) * 0.08;
      mouseRef.current.targetY = (e.clientY - window.innerHeight / 2) * 0.08;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Resize Handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // Animation Loop (60 FPS)
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Smooth Mouse Easing
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      // Rotate 3D Objects
      particleSystem.rotation.y = elapsedTime * 0.03 + mouseRef.current.x * 0.0005;
      particleSystem.rotation.x = elapsedTime * 0.015 + mouseRef.current.y * 0.0005;

      torusKnot.rotation.x = elapsedTime * 0.1;
      torusKnot.rotation.y = elapsedTime * 0.15;

      ringMesh.rotation.z = elapsedTime * 0.05;
      ringMesh.rotation.y = elapsedTime * 0.08;

      camera.position.x = mouseRef.current.x;
      camera.position.y = -mouseRef.current.y;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      knotGeometry.dispose();
      knotMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      renderer.dispose();
    };
  }, [particleColor, secondaryColor, density]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    />
  );
}
