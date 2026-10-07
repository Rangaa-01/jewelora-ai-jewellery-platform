"use client";

import { Environment, Float, Lightformer } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh } from "three";

function Ring({ reduced }: { reduced: boolean }) {
  const group = useRef<Group>(null);
  const stone = useRef<Mesh>(null);
  useFrame((state, delta) => {
    if (reduced) return;
    if (group.current) group.current.rotation.y += delta * 0.35;
    if (stone.current) stone.current.rotation.y -= delta * 0.6;
  });
  return (
    <group ref={group} rotation={[0.55, 0.4, 0]}>
      <mesh castShadow receiveShadow>
        <torusGeometry args={[1.25, 0.16, 48, 128]} />
        <meshPhysicalMaterial
          color="#e2b964"
          metalness={0.95}
          roughness={0.22}
          clearcoat={0.5}
          clearcoatRoughness={0.25}
          envMapIntensity={1.4}
        />
      </mesh>
      <mesh position={[0, 1.45, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.3, 0.3, 6]} />
        <meshStandardMaterial
          color="#e8c878"
          metalness={0.95}
          roughness={0.3}
          envMapIntensity={1.4}
        />
      </mesh>
      <mesh ref={stone} position={[0, 1.78, 0]}>
        <octahedronGeometry args={[0.34, 0]} />
        <meshPhysicalMaterial
          color="#ffffff"
          metalness={0}
          roughness={0.02}
          transmission={0.92}
          thickness={0.8}
          ior={2.4}
          clearcoat={1}
          attenuationColor="#fff8e6"
          attenuationDistance={1.5}
        />
      </mesh>
    </group>
  );
}

/** Procedural gold solitaire ring. Loaded only on the client, after the hero text is visible. */
export default function HeroScene({ reduced }: { reduced: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.6, 5.2], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      frameloop={reduced ? "demand" : "always"}
      aria-hidden
      className="!h-full !w-full"
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 3]} intensity={2.2} color="#fff4d6" castShadow />
      <directionalLight position={[-5, 2, -2]} intensity={0.9} color="#ffe2b8" />
      <pointLight position={[0, -3, 2]} intensity={0.7} color="#d9a68f" />
      <spotLight position={[0, 5, -4]} intensity={1.4} angle={0.5} penumbra={1} color="#ffffff" />
      {/* Procedural studio environment: no HDR download, works offline and under CSP. */}
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={6}
          color="#fff4dc"
          position={[0, 5, -2]}
          scale={[6, 3, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={3}
          color="#ffe6c0"
          position={[-5, 1, 2]}
          scale={[3, 6, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={2.5}
          color="#d9e8ff"
          position={[5, 0, 3]}
          scale={[3, 6, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="ring"
          intensity={2}
          color="#f1dca0"
          position={[0, -4, 1]}
          scale={4}
          target={[0, 0, 0]}
        />
      </Environment>
      <Float
        speed={reduced ? 0 : 1.6}
        rotationIntensity={reduced ? 0 : 0.25}
        floatIntensity={reduced ? 0 : 0.6}
      >
        <Ring reduced={reduced} />
      </Float>
    </Canvas>
  );
}
