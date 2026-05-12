import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

const previewFloorY = -0.58;

interface ModelViewerProps {
  category: string;
  primaryColor: string;
  accentColor: string;
  status?: "Ready" | "Failed";
  stlUrl?: string;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  wireframe?: boolean;
  pending?: boolean;
  viewMode?: "front" | "side" | "top" | "joint";
}

export function ModelViewer({ category, primaryColor, accentColor, status, stlUrl, dimensions, wireframe = false, pending = false, viewMode = "front" }: ModelViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eef1ed");

    const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    const cameraPosition = getCameraPosition(viewMode);
    camera.position.copy(cameraPosition);
    camera.lookAt(0, 0.4, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 3.8;
    controls.maxDistance = 9.5;
    controls.target.set(0, 0.25, 0);
    controls.update();

    const keyLight = new THREE.DirectionalLight("#fff8ed", 3.2);
    keyLight.position.set(4, 6, 4);
    keyLight.castShadow = true;
    scene.add(keyLight);
    scene.add(new THREE.HemisphereLight("#f5f0e8", "#9fb1b0", 1.6));

    const group = new THREE.Group();
    scene.add(group);

    const mainMaterial = new THREE.MeshStandardMaterial({
      color: status === "Failed" ? "#6d7476" : primaryColor,
      roughness: 0.62,
      metalness: 0.08,
      wireframe
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.7,
      metalness: 0.03,
      wireframe
    });
    const darkMaterial = new THREE.MeshStandardMaterial({
      color: "#253035",
      roughness: 0.5,
      metalness: 0.12,
      wireframe
    });

    if (pending) {
      addPendingPreview(group, primaryColor, accentColor, dimensions);
    } else if (stlUrl) {
      const loader = new STLLoader();
      loader.load(
        stlUrl,
        (geometry) => {
          geometry.computeVertexNormals();
          prepareLoadedStlPreview(group, geometry, mainMaterial);
        },
        undefined,
        () => {
          addParametricPreview(group, category, mainMaterial, accentMaterial, darkMaterial, dimensions);
        }
      );
    } else {
      addParametricPreview(group, category, mainMaterial, accentMaterial, darkMaterial, dimensions);
    }

    if (wireframe) {
      const grid = new THREE.GridHelper(4.8, 12, "#006c49", "#9ab1a3");
      grid.position.y = previewFloorY;
      scene.add(grid);
      const box = new THREE.BoxHelper(group, new THREE.Color("#006c49"));
      scene.add(box);
    } else {
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(3.2, 64),
        new THREE.MeshStandardMaterial({ color: "#dfe6e2", roughness: 0.8 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = previewFloorY;
      floor.receiveShadow = true;
      scene.add(floor);
    }

    let frame = 0;
    let animationId = 0;
    const animate = () => {
      frame += 0.01;
      if (pending) {
        group.rotation.y = Math.sin(frame * 0.7) * 0.12;
        group.position.y = Math.sin(frame * 1.8) * 0.025;
      } else if (!wireframe && viewMode === "front") {
        group.rotation.y = Math.sin(frame) * 0.22 + frame * 0.28;
      }
      controls.update();
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    });
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [accentColor, category, dimensions, pending, primaryColor, status, stlUrl, viewMode, wireframe]);

  return <div className="viewer-canvas" ref={mountRef} aria-label="3D model preview" />;
}

export function prepareLoadedStlPreview(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  mainMaterial: THREE.Material
) {
  geometry.center();

  const mainMesh = new THREE.Mesh(geometry, mainMaterial);
  mainMesh.rotation.x = -Math.PI / 2;
  mainMesh.castShadow = true;
  group.add(mainMesh);

  const size = new THREE.Box3().setFromObject(mainMesh).getSize(new THREE.Vector3());
  const largestAxis = Math.max(size.x, size.y, size.z) || 1;
  mainMesh.scale.setScalar(3 / largestAxis);

  const bounds = new THREE.Box3().setFromObject(group);
  group.position.y += previewFloorY - bounds.min.y + 0.01;
}

function getCameraPosition(viewMode: NonNullable<ModelViewerProps["viewMode"]>) {
  if (viewMode === "side") return new THREE.Vector3(6.8, 1.7, 0.05);
  if (viewMode === "top") return new THREE.Vector3(0.05, 7.2, 0.05);
  if (viewMode === "joint") return new THREE.Vector3(3.2, 2.2, 3.4);
  return new THREE.Vector3(4.6, 3.2, 6.2);
}

function addParametricPreview(
  group: THREE.Group,
  category: string,
  mainMaterial: THREE.Material,
  accentMaterial: THREE.Material,
  darkMaterial: THREE.Material,
  dimensions?: { length: number; width: number; height: number }
) {
  if (category === "aircraft") {
    addAircraft(group, mainMaterial, accentMaterial, darkMaterial);
  } else if (category === "ship") {
    addShip(group, mainMaterial, accentMaterial, darkMaterial);
  } else {
    addVehicle(group, mainMaterial, accentMaterial, darkMaterial);
  }
  applyDimensionScale(group, dimensions);
}

function applyDimensionScale(group: THREE.Group, dimensions?: { length: number; width: number; height: number }) {
  if (!dimensions) return;
  group.scale.set(dimensions.length / 120, dimensions.height / 38, dimensions.width / 55);
}

function addPendingPreview(
  group: THREE.Group,
  primaryColor: string,
  accentColor: string,
  dimensions?: { length: number; width: number; height: number }
) {
  const ghostMaterial = new THREE.MeshStandardMaterial({
    color: primaryColor,
    transparent: true,
    opacity: 0.12,
    roughness: 0.9,
    metalness: 0,
    wireframe: true
  });
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.22,
    roughness: 0.72,
    metalness: 0.02,
    wireframe: true
  });
  const lineMaterial = new THREE.LineBasicMaterial({
    color: "#006c49",
    transparent: true,
    opacity: 0.72
  });

  const envelope = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.05, 1.45, 4, 2, 3), ghostMaterial);
  envelope.position.y = 0.05;
  group.add(envelope);

  const core = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.9, 4, 12), coreMaterial);
  core.rotation.z = Math.PI / 2;
  core.position.y = 0.04;
  group.add(core);

  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.08, 0.72), coreMaterial);
  crossbar.position.set(0, 0.02, 0);
  group.add(crossbar);

  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.35, 1.18, 1.58)), lineMaterial);
  edges.position.y = 0.05;
  group.add(edges);

  [-0.42, 0.05, 0.52].forEach((y) => {
    const scanLine = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.45, 0.02, 1.68)), lineMaterial);
    scanLine.position.y = y;
    group.add(scanLine);
  });

  applyDimensionScale(group, dimensions);
}

function addVehicle(
  group: THREE.Group,
  main: THREE.Material,
  accent: THREE.Material,
  dark: THREE.Material
) {
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.65, 1.2), main);
  body.position.y = 0.04;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.55, 0.9), accent);
  cabin.position.set(-0.15, 0.58, 0);
  cabin.castShadow = true;
  group.add(cabin);

  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 1.25), accent);
  spoiler.position.set(-1.28, 0.52, 0);
  spoiler.castShadow = true;
  group.add(spoiler);

  [-1.0, 1.0].forEach((x) => {
    [-0.72, 0.72].forEach((z) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 28), dark);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, -0.34, z);
      wheel.castShadow = true;
      group.add(wheel);
    });
  });
}

function addAircraft(
  group: THREE.Group,
  main: THREE.Material,
  accent: THREE.Material,
  dark: THREE.Material
) {
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 2.4, 8, 24), main);
  fuselage.rotation.z = Math.PI / 2;
  fuselage.castShadow = true;
  group.add(fuselage);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 3.6), accent);
  wing.position.set(0.05, 0, 0);
  wing.castShadow = true;
  group.add(wing);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 1.2), accent);
  tail.position.set(-1.25, 0.2, 0);
  tail.castShadow = true;
  group.add(tail);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.12), accent);
  fin.position.set(-1.35, 0.43, 0);
  fin.castShadow = true;
  group.add(fin);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.72, 32), dark);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(1.55, 0, 0);
  nose.castShadow = true;
  group.add(nose);
}

function addShip(
  group: THREE.Group,
  main: THREE.Material,
  accent: THREE.Material,
  dark: THREE.Material
) {
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.58, 1.05), main);
  hull.position.y = -0.12;
  hull.castShadow = true;
  group.add(hull);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.0, 4), main);
  bow.rotation.z = -Math.PI / 2;
  bow.position.set(1.78, -0.12, 0);
  bow.scale.z = 0.9;
  bow.castShadow = true;
  group.add(bow);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.76), accent);
  deck.position.set(-0.2, 0.28, 0);
  deck.castShadow = true;
  group.add(deck);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.72, 0.56), accent);
  bridge.position.set(-0.45, 0.82, 0);
  bridge.castShadow = true;
  group.add(bridge);

  const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 0.22), dark);
  base.position.set(0, -0.55, 0);
  base.castShadow = true;
  group.add(base);
}
