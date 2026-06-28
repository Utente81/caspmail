import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ─────────────────────────────────────────────────────────────────────────────
   GALAXY CYBERSECURITY — spirale animata con bracci, nebulose e nodi brillanti
───────────────────────────────────────────────────────────────────────────── */

const GalaxyCore = () => {
  const pointsRef = useRef();

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.04;
      pointsRef.current.rotation.z += delta * 0.01;
    }
  });

  const { positions, colors, sizes } = useMemo(() => {
    const COUNT   = 12000;
    const ARMS    = 3;
    const SPIN    = 1.5;   // curvatura dei bracci
    const SPREAD  = 0.4;   // dispersione attorno ai bracci
    const RADIUS  = 5.5;   // raggio massimo della galassia

    const pos  = new Float32Array(COUNT * 3);
    const col  = new Float32Array(COUNT * 3);
    const siz  = new Float32Array(COUNT);
    const tmp  = new THREE.Color();

    // Palette cybersecurity
    const palettes = [
      { h: 192, s: 1.0, l: 0.65 },  // ciano brillante
      { h: 210, s: 0.9, l: 0.55 },  // azzurro tech
      { h: 220, s: 0.8, l: 0.45 },  // blu profondo
      { h: 270, s: 0.8, l: 0.60 },  // viola enterprise
      { h: 185, s: 1.0, l: 0.75 },  // ciano chiaro
    ];

    for (let i = 0; i < COUNT; i++) {
      // Distribuzione radiale (più densa al centro)
      const r   = Math.pow(Math.random(), 1.8) * RADIUS;
      const arm = (i % ARMS) / ARMS;   // quale braccio
      const angle = arm * Math.PI * 2 + r * SPIN + (Math.random() - 0.5) * SPREAD * 2;

      // Piccola dispersione fuori dal piano
      const dispX = (Math.random() - 0.5) * SPREAD * r * 0.5;
      const dispY = (Math.random() - 0.5) * 0.3;
      const dispZ = (Math.random() - 0.5) * SPREAD * r * 0.5;

      pos[i * 3]     = Math.cos(angle) * r + dispX;
      pos[i * 3 + 1] = dispY;
      pos[i * 3 + 2] = Math.sin(angle) * r + dispZ;

      // Colore: nucleo caldo (quasi bianco-ciano), bordi più freddi e violetti
      const ratio = r / RADIUS;
      const pIdx  = Math.floor(Math.random() * palettes.length);
      const p     = palettes[pIdx];
      // Schiarisce verso il centro
      const lightness = p.l + (1 - ratio) * 0.25;
      tmp.setHSL(p.h / 360, p.s, Math.min(lightness, 0.95));
      col[i * 3]     = tmp.r;
      col[i * 3 + 1] = tmp.g;
      col[i * 3 + 2] = tmp.b;

      // Dimensioni: stelle centrali più grandi, bordi piccoli
      const baseSize = ratio < 0.15 ? 0.06 + Math.random() * 0.08
                     : ratio < 0.4  ? 0.025 + Math.random() * 0.035
                     :                0.01  + Math.random() * 0.02;
      siz[i] = baseSize;
    }

    return { positions: pos, colors: col, sizes: siz };
  }, []);

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color"    count={COUNT} array={colors}    itemSize={3} />
        <bufferAttribute attach="attributes-size"     count={COUNT} array={sizes}     itemSize={1} />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        vertexColors
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
};

// Nodi luminosi — "data nodes" tipici dell'estetica cyber
const DataNodes = () => {
  const ref = useRef();
  useFrame((_, d) => {
    if (ref.current) {
      ref.current.rotation.y -= d * 0.025;
      ref.current.rotation.z += d * 0.008;
    }
  });

  const { positions, colors } = useMemo(() => {
    const N   = 300;
    const R   = 5.5;
    const ARMS = 3;
    const SPIN = 1.5;

    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const tmp = new THREE.Color();
    const nodeColors = ['#00e5ff', '#38bdf8', '#a78bfa', '#c084fc', '#ffffff'];

    for (let i = 0; i < N; i++) {
      const r     = Math.pow(Math.random(), 2) * R;
      const arm   = (i % ARMS) / ARMS;
      const angle = arm * Math.PI * 2 + r * SPIN;

      pos[i * 3]     = Math.cos(angle) * r + (Math.random() - 0.5) * 0.4;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
      pos[i * 3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * 0.4;

      tmp.set(nodeColors[Math.floor(Math.random() * nodeColors.length)]);
      col[i * 3]     = tmp.r;
      col[i * 3 + 1] = tmp.g;
      col[i * 3 + 2] = tmp.b;
    }
    return { positions: pos, colors: col };
  }, []);

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={300} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color"    count={300} array={colors}    itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        vertexColors
        transparent
        opacity={0.95}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
};

// Nebulosa — nuvola di punti grandi e sfumati attorno al nucleo
const Nebula = () => {
  const ref = useRef();
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y -= d * 0.015;
  });

  const { positions, colors } = useMemo(() => {
    const N   = 800;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const tmp = new THREE.Color();
    const nebulaColors = ['#0ea5e9', '#7c3aed', '#0891b2', '#4f46e5'];

    for (let i = 0; i < N; i++) {
      // Distribuzione gaussiana attorno al centro
      const r    = (Math.random() + Math.random()) * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI;

      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.25; // piatta
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      tmp.set(nebulaColors[Math.floor(Math.random() * nebulaColors.length)]);
      col[i * 3]     = tmp.r * 0.4;
      col[i * 3 + 1] = tmp.g * 0.4;
      col[i * 3 + 2] = tmp.b * 0.4;
    }
    return { positions: pos, colors: col };
  }, []);

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={800} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color"    count={800} array={colors}    itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.35}
        vertexColors
        transparent
        opacity={0.18}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
};

const COUNT = 12000;

export default function GalaxyBackground() {
  return (
    <div className="galaxy-canvas-container">
      <Canvas
        camera={{ position: [0, 4.5, 9], fov: 65 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
      >
        <React.Suspense fallback={null}>
          <Nebula />
          <GalaxyCore />
          <DataNodes />
        </React.Suspense>
      </Canvas>
    </div>
  );
}
