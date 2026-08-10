import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeDOrbWidgetProps {
  size?: number;
  className?: string;
}

export default function ThreeDOrbWidget({
  size = 180,
  className = "",
}: ThreeDOrbWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Canvas & WebGL Context check
    let canvas: HTMLCanvasElement;
    try {
      canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return;
    } catch {
      return;
    }

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 220;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    container.appendChild(renderer.domElement);

    // 1. Inner Glowing Wireframe Sphere (Face Authentication Core)
    const sphereGeometry = new THREE.IcosahedronGeometry(45, 2);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, // Sky blue cyan
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });
    const sphereMesh = new THREE.Mesh(sphereGeometry, wireframeMaterial);
    scene.add(sphereMesh);

    // 2. Inner Core Point Light
    const innerLight = new THREE.PointLight(0x818cf8, 3, 200);
    scene.add(innerLight);

    // 3. Outer Holographic Ring 1
    const ring1Geo = new THREE.TorusGeometry(62, 1.2, 16, 100);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x818cf8, // Indigo
      transparent: true,
      opacity: 0.75,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 3;
    scene.add(ring1);

    // 4. Outer Holographic Ring 2 (Perpendicular Orbit)
    const ring2Geo = new THREE.TorusGeometry(72, 1, 16, 100);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0xc084fc, // Purple accent
      transparent: true,
      opacity: 0.5,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.y = Math.PI / 4;
    ring2.rotation.x = -Math.PI / 6;
    scene.add(ring2);

    // 5. Floating Orbital Nodes (Security / Attendance Signal Nodes)
    const nodeCount = 18;
    const nodeGeo = new THREE.SphereGeometry(2.5, 8, 8);
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const nodesGroup = new THREE.Group();

    for (let i = 0; i < nodeCount; i++) {
      const node = new THREE.Mesh(nodeGeo, nodeMat);
      const angle = (i / nodeCount) * Math.PI * 2;
      const radius = 55 + (i % 3) * 8;
      node.position.set(
        Math.cos(angle) * radius,
        (Math.sin(i) * radius) / 2,
        Math.sin(angle) * radius,
      );
      nodesGroup.add(node);
    }
    scene.add(nodesGroup);

    // Mouse tilt tracking
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseRef.current = { x, y };
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Rotation animations
      sphereMesh.rotation.y = elapsedTime * 0.35;
      sphereMesh.rotation.x = elapsedTime * 0.15;

      ring1.rotation.z = elapsedTime * 0.4;
      ring1.rotation.y = elapsedTime * 0.2;

      ring2.rotation.z = -elapsedTime * 0.3;
      ring2.rotation.x = elapsedTime * 0.25;

      nodesGroup.rotation.y = -elapsedTime * 0.25;

      // Mouse interactive inertia tracking
      scene.rotation.y += (mouseRef.current.x * 0.4 - scene.rotation.y) * 0.05;
      scene.rotation.x += (-mouseRef.current.y * 0.4 - scene.rotation.x) * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      sphereGeometry.dispose();
      wireframeMaterial.dispose();
      ring1Geo.dispose();
      ring1Mat.dispose();
      ring2Geo.dispose();
      ring2Mat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [size]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing ${className}`}
      style={{ width: size, height: size }}
      title="3D Holographic AI Core"
    />
  );
}
