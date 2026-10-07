"use client";

/**
 * The three.js heavy part of the viewer. Only ever imported through `next/dynamic`
 * from `jewellery-viewer.tsx`, so nothing here lands in the initial route chunk.
 */

import { ContactShadows, OrbitControls, Sparkles, useGLTF } from "@react-three/drei";
import { Canvas, invalidate, useThree } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  Box3,
  Color,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector3,
  type Material,
  type Object3D,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { StudioEnvironment, StudioLights } from "./studio-environment";
import type { MetalType, StoneType } from "@/lib/api/types";
import {
  classifyMaterialName,
  gemPreset,
  metalPreset,
  stoneFromMaterialName,
} from "@/lib/viewer3d/materials";

export type CameraPreset = "front" | "top" | "side";

export interface SceneHandle {
  setPreset: (preset: CameraPreset) => void;
  reset: () => void;
  zoom: (factor: number) => void;
}

export interface JewellerySceneProps {
  url: string;
  metal: MetalType;
  tintHex: string | null;
  stone: StoneType | null;
  autoRotate: boolean;
  sparkles: boolean;
  onInteract?: () => void;
  onError: (error: Error) => void;
  onLoaded?: () => void;
  sceneRef: React.Ref<SceneHandle>;
}

const PRESETS: Record<CameraPreset, [number, number, number]> = {
  front: [0, 0.6, 4.4],
  top: [0, 4.6, 0.01],
  side: [4.4, 0.5, 0],
};
const MIN_DISTANCE = 1.6;
const MAX_DISTANCE = 9;
const TARGET_SIZE = 2; // models are normalised so their longest side is 2 units

class SceneErrorBoundary extends Component<
  { onError: (e: Error) => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Replace/upgrade materials by naming convention; returns gem meshes for the sparkle layer. */
function upgradeMaterials(
  root: Object3D,
  metal: MetalType,
  tintHex: string | null,
  stone: StoneType | null,
  created: Material[],
): Mesh[] {
  const gems: Mesh[] = [];
  const mp = metalPreset(metal, tintHex);
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = materials.map((mat) => {
      const kind = classifyMaterialName(mat.name);
      if (kind === "metal") {
        const m = new MeshPhysicalMaterial({
          name: mat.name,
          color: new Color(mp.color),
          metalness: mp.metalness,
          roughness: mp.roughness,
          clearcoat: mp.clearcoat,
          clearcoatRoughness: mp.clearcoatRoughness,
          envMapIntensity: mp.envMapIntensity,
        });
        created.push(m);
        return m;
      }
      if (kind === "gem") {
        const authored = stoneFromMaterialName(mat.name);
        const preset = gemPreset(stone ?? authored);
        const authoredColor = (mat as MeshStandardMaterial).color;
        const m = new MeshPhysicalMaterial({
          name: mat.name,
          color: stone || !authoredColor ? new Color(preset.color) : authoredColor.clone(),
          metalness: 0,
          roughness: preset.roughness,
          transmission: preset.transmission,
          ior: preset.ior,
          thickness: preset.thickness,
          clearcoat: preset.clearcoat,
          attenuationColor: new Color(preset.attenuationColor),
          attenuationDistance: preset.attenuationDistance,
          envMapIntensity: preset.envMapIntensity,
          transparent: preset.transmission > 0,
        });
        created.push(m);
        if (preset.sparkle) gems.push(mesh);
        return m;
      }
      return mat;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0]!;
    mesh.castShadow = true;
  });
  return gems;
}

function Model({
  url,
  metal,
  tintHex,
  stone,
  sparkles,
  onLoaded,
}: Pick<JewellerySceneProps, "url" | "metal" | "tintHex" | "stone" | "sparkles" | "onLoaded">) {
  const gltf = useGLTF(url);

  // Clone per instance so material swaps never leak into drei's shared cache.
  const { scene, scale, gemBox, created } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const box = new Box3().setFromObject(clone);
    const size = new Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z) || 1;
    const s = TARGET_SIZE / longest;
    const centre = new Vector3();
    box.getCenter(centre);
    clone.position.sub(centre);
    const created: Material[] = [];
    const gems = upgradeMaterials(clone, metal, tintHex, stone, created);
    let gBox: Box3 | null = null;
    if (gems.length) {
      gBox = new Box3();
      for (const g of gems) gBox.expandByObject(g);
      gBox.min.sub(centre).multiplyScalar(s);
      gBox.max.sub(centre).multiplyScalar(s);
    }
    return { scene: clone, scale: s, gemBox: gBox, created };
  }, [gltf.scene, metal, tintHex, stone]);

  useEffect(() => {
    onLoaded?.();
    invalidate();
  }, [scene, onLoaded]);

  // Dispose the materials this instance created when they are replaced or on unmount.
  useEffect(() => () => created.forEach((m) => m.dispose()), [created]);

  const sparkleSize = gemBox ? gemBox.getSize(new Vector3()) : null;
  const sparkleCentre = gemBox ? gemBox.getCenter(new Vector3()).divideScalar(scale) : null;

  return (
    <group scale={scale}>
      {/* Centre offset is in model units; the parent group applies the normalising scale. */}
      <primitive object={scene} />
      {sparkles && sparkleSize && sparkleCentre && (
        <group position={sparkleCentre} scale={1 / scale}>
          <Sparkles
            count={36}
            size={2.2}
            speed={0.35}
            opacity={0.7}
            color="#fff8e6"
            scale={[sparkleSize.x + 0.4, sparkleSize.y + 0.4, sparkleSize.z + 0.4]}
          />
        </group>
      )}
    </group>
  );
}

function Controls({
  autoRotate,
  onInteract,
  sceneRef,
}: Pick<JewellerySceneProps, "autoRotate" | "onInteract" | "sceneRef">) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);

  const setPreset = (preset: CameraPreset) => {
    const [x, y, z] = PRESETS[preset];
    camera.position.set(x, y, z);
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
    invalidate();
  };

  useImperativeHandle(
    sceneRef,
    () => ({
      setPreset,
      reset: () => setPreset("front"),
      zoom: (factor: number) => {
        const c = controls.current;
        if (!c) return;
        const target = c.target;
        const offset = camera.position.clone().sub(target);
        const next = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, offset.length() * factor));
        camera.position.copy(target.clone().add(offset.setLength(next)));
        c.update();
        invalidate();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camera],
  );

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      enablePan
      panSpeed={0.6}
      rotateSpeed={0.8}
      autoRotate={autoRotate}
      autoRotateSpeed={0.9}
      onStart={onInteract}
      touches={{ ONE: 0, TWO: 2 }}
    />
  );
}

export default function JewelleryScene(props: JewellerySceneProps) {
  const {
    url,
    metal,
    tintHex,
    stone,
    autoRotate,
    sparkles,
    onInteract,
    onError,
    onLoaded,
    sceneRef,
  } = props;
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: PRESETS.front, fov: 36, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={autoRotate ? "always" : "demand"}
      className="!h-full !w-full touch-none"
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onError(new Error("webgl-context-lost"));
        });
      }}
    >
      <StudioLights />
      <StudioEnvironment />
      <SceneErrorBoundary onError={onError}>
        <Suspense fallback={null}>
          <Model
            url={url}
            metal={metal}
            tintHex={tintHex}
            stone={stone}
            sparkles={sparkles}
            onLoaded={onLoaded}
          />
        </Suspense>
      </SceneErrorBoundary>
      <ContactShadows
        position={[0, -1.15, 0]}
        opacity={0.35}
        scale={6}
        blur={2.4}
        far={2}
        resolution={512}
        frames={1}
      />
      <Controls autoRotate={autoRotate} onInteract={onInteract} sceneRef={sceneRef} />
    </Canvas>
  );
}

/** Warm the GLB cache on intent (hover/focus of the "View in 3D" control). */
export function preloadModel(url: string) {
  useGLTF.preload(url);
}
