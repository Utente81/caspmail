import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ─────────────────────────────────────────────────────────────────────────────
   EarthGlobe
   Usa una texture topografica reale per determinare dove si trovano le
   terre emerse, poi posiziona particelle ciano brillanti su quei pixel.
───────────────────────────────────────────────────────────────────────────── */
const EarthGlobe = ({ imgData, width, height }) => {
  const groupRef = useRef();

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.10;
    }
  });

  const { landPos, oceanPos, landCol, connLines } = useMemo(() => {
    if (!imgData) return { landPos: new Float32Array(0), oceanPos: new Float32Array(0), landCol: new Float32Array(0), connLines: new Float32Array(0) };

    const R = 2.4;
    const landPts = [];
    const oceanPts = [];
    const step = 3; // campiona ogni 3 pixel per performance

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const brightness = (r + g + b) / 3;

        // La texture topology ha valori alti per le terre (verde/marrone) e bassi per gli oceani
        const isLand = brightness > 40;

        // Converti pixel (x,y) → lat/lon → coordinate sferiche
        const lon = (x / width) * 360 - 180;
        const lat = 90 - (y / height) * 180;
        const phi   = (90 - lat)  * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);

        const px = -R * Math.sin(phi) * Math.cos(theta);
        const py =  R * Math.cos(phi);
        const pz =  R * Math.sin(phi) * Math.sin(theta);

        if (isLand) {
          landPts.push([px, py, pz]);
        } else if (Math.random() < 0.05) {
          // oceano: scarso
          oceanPts.push([px, py, pz]);
        }
      }
    }

    // ── Posizioni ──
    const landPos  = new Float32Array(landPts.flat());
    const oceanPos = new Float32Array(oceanPts.flat());

    // ── Colori per le terre ──
    const landCol = new Float32Array(landPts.length * 3);
    for (let i = 0; i < landPts.length; i++) {
      const v = 0.6 + Math.random() * 0.4;
      landCol[i * 3]     = 0;
      landCol[i * 3 + 1] = v * 0.95;
      landCol[i * 3 + 2] = v;
    }

    // ── Linee di connessione tra punti vicini sulla terra ──
    const sample = landPts.filter(() => Math.random() < 0.08); // subset
    const verts = [];
    const maxD  = 0.5;
    for (let i = 0; i < sample.length; i++) {
      for (let j = i + 1; j < sample.length; j++) {
        const dx = sample[i][0] - sample[j][0];
        const dy = sample[i][1] - sample[j][1];
        const dz = sample[i][2] - sample[j][2];
        if (dx*dx + dy*dy + dz*dz < maxD*maxD) {
          verts.push(...sample[i], ...sample[j]);
        }
      }
    }
    const connLines = new Float32Array(verts);

    return { landPos, oceanPos, landCol, connLines };
  }, [imgData, width, height]);

  if (!imgData) return null;

  return (
    <group ref={groupRef}>
      {/* Nucleo scuro — maschera il lato opposto del globo */}
      <mesh>
        <sphereGeometry args={[2.35, 64, 64]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.98} depthWrite />
      </mesh>

      {/* Oceani: punti tenue */}
      {oceanPos.length > 0 && (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={oceanPos.length / 3} array={oceanPos} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial size={0.018} color="#003a5c" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
        </points>
      )}

      {/* Terre: punti ciano brillanti */}
      {landPos.length > 0 && (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={landPos.length / 3} array={landPos} itemSize={3} />
            <bufferAttribute attach="attributes-color"    count={landCol.length / 3} array={landCol} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial size={0.028} vertexColors transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
        </points>
      )}

      {/* Linee connessione continenti */}
      {connLines.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={connLines.length / 3} array={connLines} itemSize={3} />
          </bufferGeometry>
          <lineBasicMaterial color="#00e5ff" transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} />
        </lineSegments>
      )}

      {/* Alone atmosferico */}
      <mesh>
        <sphereGeometry args={[2.5, 64, 64]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.03} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Glow esterno diffuso */}
      <mesh>
        <sphereGeometry args={[2.85, 64, 64]} />
        <meshBasicMaterial color="#006080" transparent opacity={0.05} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

/* Anello orbitale */
const OrbitRing = () => {
  const r = useRef();
  useFrame((_, d) => { if (r.current) r.current.rotation.z -= d * 0.05; });
  return (
    <group ref={r} rotation={[Math.PI / 7, 0, 0.3]}>
      <mesh>
        <torusGeometry args={[2.72, 0.006, 8, 160]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Componente principale — carica la texture via <img> + Canvas 2D
───────────────────────────────────────────────────────────────────────────── */
export default function RealisticPlanet() {
  const [texData, setTexData] = useState(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/earth-mask.png';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Lavoriamo a risoluzione ridotta per velocità
      canvas.width  = 360;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 360, 180);
      const data = ctx.getImageData(0, 0, 360, 180);
      setTexData({ data: data.data, width: 360, height: 180 });
    };
    img.onerror = () => {
      // Fallback: nessuna texture, usa distribuzione sferica uniforme
      setTexData({ data: null, width: 0, height: 0 });
    };
  }, []);

  return (
    <div className="webgl-planet-container">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <React.Suspense fallback={null}>
          {texData && (
            <EarthGlobe
              imgData={texData.data}
              width={texData.width}
              height={texData.height}
            />
          )}
          <OrbitRing />
        </React.Suspense>
      </Canvas>
    </div>
  );
}
