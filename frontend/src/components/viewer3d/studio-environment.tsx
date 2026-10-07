"use client";

import { Environment, Lightformer } from "@react-three/drei";

/**
 * Procedural studio lighting shared by every 3D scene: no HDR download, works offline and
 * under the CSP. Warm key, cool fill, gold bounce from below.
 */
export function StudioEnvironment({ resolution = 128 }: { resolution?: number }) {
  return (
    <Environment resolution={resolution} frames={1}>
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
      {/* Soft dome so white metals and platinum reflect a bright studio rather than black. */}
      <Lightformer
        form="rect"
        intensity={1.2}
        color="#f6efe4"
        position={[0, 0, -9]}
        scale={[22, 22, 1]}
        target={[0, 0, 0]}
      />
      <Lightformer
        form="rect"
        intensity={1.0}
        color="#efe7da"
        position={[0, 0, 9]}
        scale={[22, 22, 1]}
        target={[0, 0, 0]}
      />
      <Lightformer
        form="rect"
        intensity={0.8}
        color="#e9e1d4"
        position={[0, 9, 0]}
        scale={[22, 22, 1]}
        target={[0, 0, 0]}
      />
    </Environment>
  );
}

export function StudioLights() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[4, 6, 3]} intensity={1.8} color="#fff4d6" />
      <directionalLight position={[-5, 2, -2]} intensity={0.7} color="#ffe2b8" />
      <spotLight position={[0, 5, -4]} intensity={1.2} angle={0.5} penumbra={1} color="#ffffff" />
    </>
  );
}
