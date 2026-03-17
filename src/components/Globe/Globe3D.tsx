import { useRef, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin } from 'lucide-react';
import type { Visitor } from '../../hooks/useVisitors';
import type { HistoricalVisitor } from '../../hooks/useVisitorHistory';

interface Globe3DProps {
  visitors: Visitor[];
  currentVisitorId: string | null;
  historicalVisitors?: HistoricalVisitor[];
  showAllTime?: boolean;
}

interface PinTooltipData {
  x: number;
  y: number;
  city: string;
  country: string;
  connectedAt: number;
  type: 'live' | 'historical' | 'you';
  region?: string;
  timezone?: string;
  isp?: string;
  ip?: string;
  lat?: number;
  lng?: number;
}

function latLongToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

function generateArcPoints(
  startLat: number, startLon: number,
  endLat: number, endLon: number,
  segments: number = 20
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const start = latLongToVector3(startLat, startLon, 2.05);
  const end = latLongToVector3(endLat, endLon, 2.05);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = new THREE.Vector3().lerpVectors(start, end, t);
    const arcHeight = Math.sin(t * Math.PI) * 0.5;
    point.normalize().multiplyScalar(2.05 + arcHeight);
    points.push(point);
  }

  return points;
}

function GlobeGrid() {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const radius = 2.02;

    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = 0; lon <= 360; lon += 10) {
        const v1 = latLongToVector3(lat, lon, radius);
        const v2 = latLongToVector3(lat, lon + 10, radius);
        vertices.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
      }
    }

    for (let lon = 0; lon < 360; lon += 30) {
      for (let lat = -60; lat < 60; lat += 10) {
        const v1 = latLongToVector3(lat, lon, radius);
        const v2 = latLongToVector3(lat + 10, lon, radius);
        vertices.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
      }
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geo;
  }, []);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#00f0ff" opacity={0.12} transparent />
    </lineSegments>
  );
}

function projectToScreen(
  worldPos: THREE.Vector3,
  globeRef: React.RefObject<THREE.Group | null>,
  camera: THREE.Camera,
  gl: THREE.WebGLRenderer,
): { x: number; y: number; visible: boolean } | null {
  if (!globeRef.current) return null;
  const pos = worldPos.clone().applyMatrix4(globeRef.current.matrixWorld);
  const screenPos = pos.clone().project(camera);
  const canvas = gl.domElement;
  const rect = canvas.getBoundingClientRect();
  return {
    x: (screenPos.x * 0.5 + 0.5) * rect.width + rect.left,
    y: (-screenPos.y * 0.5 + 0.5) * rect.height + rect.top,
    visible: screenPos.z < 1,
  };
}

function VisitorPin({ 
  lat, lon, isCurrentUser, visitorId, globeRef, onPositionUpdate, onPinClick,
  city, country, connectedAt, region, timezone, isp, ip,
}: {
  lat: number;
  lon: number;
  isCurrentUser: boolean;
  visitorId: string;
  globeRef: React.RefObject<THREE.Group | null>;
  onPositionUpdate: (id: string, pos: { x: number; y: number; visible: boolean }) => void;
  onPinClick: (data: PinTooltipData) => void;
  city?: string;
  country?: string;
  connectedAt?: number;
  region?: string;
  timezone?: string;
  isp?: string;
  ip?: string;
}) {
  const position = useMemo(() => latLongToVector3(lat, lon, 2.15), [lat, lon]);
  const labelPosition = useMemo(() => latLongToVector3(lat, lon, 2.5), [lat, lon]);
  const pinRef = useRef<THREE.Mesh>(null);
  const { camera, gl } = useThree();
  const frameCount = useRef(0);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const color = isCurrentUser ? '#00f0ff' : '#ff2d55';
  const size = isCurrentUser ? 0.1 : 0.06;

  const handleClick = useCallback(() => {
    const screen = projectToScreen(position, globeRef, camera, gl);
    if (screen && screen.visible) {
      onPinClick({
        x: screen.x,
        y: screen.y,
        city: city || 'Unknown',
        country: country || 'Unknown',
        connectedAt: connectedAt || Date.now(),
        type: isCurrentUser ? 'you' : 'live',
        region,
        timezone,
        isp,
        ip,
        lat,
        lng: lon,
      });
    }
  }, [position, globeRef, camera, gl, onPinClick, city, country, connectedAt, isCurrentUser, region, timezone, isp, ip, lat, lon]);

  useFrame((state) => {
    frameCount.current++;
    if (frameCount.current % 10 !== 0) return;

    if (pinRef.current && isCurrentUser) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
      pinRef.current.scale.setScalar(scale);
    }

    if (isCurrentUser && globeRef.current) {
      const worldPos = labelPosition.clone();
      worldPos.applyMatrix4(globeRef.current.matrixWorld);
      
      const screenPos = worldPos.clone().project(camera);
      
      const canvas = gl.domElement;
      const rect = canvas.getBoundingClientRect();
      const x = (screenPos.x * 0.5 + 0.5) * rect.width + rect.left;
      const y = (-screenPos.y * 0.5 + 0.5) * rect.height + rect.top;
      
      const visible = screenPos.z < 1;
      
      if (Math.abs(lastPosRef.current.x - x) > 5 || Math.abs(lastPosRef.current.y - y) > 5) {
        lastPosRef.current = { x, y };
        onPositionUpdate(visitorId, { x, y, visible });
      }
    }
  });

  return (
    <group position={position} onClick={handleClick}>
      <mesh ref={pinRef}>
        <sphereGeometry args={[size, 6, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 1.5, size * 2, 12]} />
        <meshBasicMaterial color={color} opacity={0.4} transparent side={THREE.DoubleSide} />
      </mesh>
      {/* Larger hit area for easier clicking */}
      <mesh>
        <sphereGeometry args={[size * 4, 6, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function VisitorArc({ startLat, startLon, endLat, endLon }: { 
  startLat: number; startLon: number; endLat: number; endLon: number;
}) {
  const points = useMemo(
    () => generateArcPoints(startLat, startLon, endLat, endLon),
    [startLat, startLon, endLat, endLon]
  );

  return (
    <Line points={points} color="#00f0ff" lineWidth={1} transparent opacity={0.4} />
  );
}

function HistoricalPin({ visitor, globeRef, onPinClick }: {
  visitor: HistoricalVisitor;
  globeRef: React.RefObject<THREE.Group | null>;
  onPinClick: (data: PinTooltipData) => void;
}) {
  const position = useMemo(() => latLongToVector3(visitor.lat, visitor.lng, 2.15), [visitor.lat, visitor.lng]);
  const { camera, gl } = useThree();
  const size = 0.06;

  const handleClick = useCallback(() => {
    const screen = projectToScreen(position, globeRef, camera, gl);
    if (screen && screen.visible) {
      onPinClick({
        x: screen.x,
        y: screen.y,
        city: visitor.city,
        country: visitor.country,
        connectedAt: visitor.connectedAt,
        type: 'historical',
        lat: visitor.lat,
        lng: visitor.lng,
      });
    }
  }, [position, globeRef, camera, gl, onPinClick, visitor]);

  return (
    <group position={position} onClick={handleClick}>
      <mesh>
        <sphereGeometry args={[size, 6, 6]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 1.5, size * 2, 12]} />
        <meshBasicMaterial color="#22c55e" opacity={0.3} transparent side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[size * 4, 6, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function HistoricalPins({ visitors, globeRef, onPinClick }: {
  visitors: HistoricalVisitor[];
  globeRef: React.RefObject<THREE.Group | null>;
  onPinClick: (data: PinTooltipData) => void;
}) {
  if (visitors.length === 0) return null;

  return (
    <>
      {visitors.map((v, i) => (
        <HistoricalPin
          key={`h-${v.connectedAt}-${i}`}
          visitor={v}
          globeRef={globeRef}
          onPinClick={onPinClick}
        />
      ))}
    </>
  );
}

function RotatingGlobe({ 
  visitors, currentVisitorId, globeRef, onPositionUpdate,
  historicalVisitors, showAllTime, onPinClick,
}: { 
  visitors: Visitor[];
  currentVisitorId: string | null;
  globeRef: React.RefObject<THREE.Group | null>;
  onPositionUpdate: (id: string, pos: { x: number; y: number; visible: boolean }) => void;
  historicalVisitors?: HistoricalVisitor[];
  showAllTime?: boolean;
  onPinClick: (data: PinTooltipData) => void;
}) {
  useFrame((_, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.05;
    }
  });

  const currentVisitor = visitors.find(v => v.id === currentVisitorId);
  const otherVisitors = visitors.filter(v => v.id !== currentVisitorId && v.geo);

  return (
    <group ref={globeRef}>
      <Sphere args={[2, 32, 32]}>
        <meshBasicMaterial color="#05050a" opacity={0.95} transparent />
      </Sphere>
      
      <Sphere args={[2.01, 24, 24]}>
        <meshBasicMaterial color="#00f0ff" wireframe opacity={0.08} transparent />
      </Sphere>

      <GlobeGrid />

      {visitors.map((visitor) => {
        if (!visitor.geo) return null;
        const isCurrentUser = visitor.id === currentVisitorId;
        
        return (
          <VisitorPin
            key={visitor.id}
            lat={visitor.geo.lat}
            lon={visitor.geo.lng}
            isCurrentUser={isCurrentUser}
            visitorId={visitor.id}
            globeRef={globeRef}
            onPositionUpdate={onPositionUpdate}
            onPinClick={onPinClick}
            city={visitor.geo.city}
            country={visitor.geo.country}
            connectedAt={visitor.connectedAt}
            region={visitor.geo.region}
            timezone={visitor.geo.timezone}
            isp={visitor.geo.isp}
            ip={visitor.geo.ip}
          />
        );
      })}

      {currentVisitor?.geo && otherVisitors.map((visitor) => (
        <VisitorArc
          key={`arc-${visitor.id}`}
          startLat={currentVisitor.geo!.lat}
          startLon={currentVisitor.geo!.lng}
          endLat={visitor.geo!.lat}
          endLon={visitor.geo!.lng}
        />
      ))}

      {showAllTime && historicalVisitors && (
        <HistoricalPins
          visitors={historicalVisitors}
          globeRef={globeRef}
          onPinClick={onPinClick}
        />
      )}
    </group>
  );
}

function GlobeScene({ 
  visitors, currentVisitorId, globeRef, onPositionUpdate,
  historicalVisitors, showAllTime, onPinClick,
}: { 
  visitors: Visitor[];
  currentVisitorId: string | null;
  globeRef: React.RefObject<THREE.Group | null>;
  onPositionUpdate: (id: string, pos: { x: number; y: number; visible: boolean }) => void;
  historicalVisitors?: HistoricalVisitor[];
  showAllTime?: boolean;
  onPinClick: (data: PinTooltipData) => void;
}) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={0.6} color="#00f0ff" />
      <RotatingGlobe 
        visitors={visitors}
        currentVisitorId={currentVisitorId}
        globeRef={globeRef}
        onPositionUpdate={onPositionUpdate}
        historicalVisitors={historicalVisitors}
        showAllTime={showAllTime}
        onPinClick={onPinClick}
      />
      <OrbitControls 
        enableZoom={false} 
        enablePan={false}
        autoRotate={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI - Math.PI / 4}
      />
    </>
  );
}

function FloatingLabel({ x, y, visible }: { x: number; y: number; visible: boolean }) {
  if (!visible) return null;
  
  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        transform: 'translate(-50%, -100%)',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      <div className="bg-cyber-bg/95 backdrop-blur-xl px-3 py-1.5 rounded-lg text-[10px] font-mono text-cyber-cyan whitespace-nowrap border border-cyber-cyan/30 shadow-lg shadow-cyber-cyan/20">
        <MapPin size={10} className="inline mr-1.5" />
        YOU ARE HERE
      </div>
    </div>,
    document.body
  );
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function PinTooltip({ data, onClose }: { data: PinTooltipData; onClose: () => void }) {
  const colorMap = { you: '#00f0ff', live: '#ff2d55', historical: '#22c55e' };
  const labelMap = { you: 'You', live: 'Online Now', historical: 'Visited' };
  const color = colorMap[data.type];

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          left: data.x,
          top: data.y,
          transform: 'translate(-50%, calc(-100% - 12px))',
          zIndex: 100000,
        }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <div
          className="bg-cyber-bg/95 backdrop-blur-xl px-4 py-3 rounded-xl border shadow-xl min-w-[200px]"
          style={{ borderColor: `${color}33`, boxShadow: `0 4px 20px ${color}15` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
            <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color }}>
              {labelMap[data.type]}
            </span>
            <span className="text-white/20 text-[9px] font-mono ml-auto">
              {data.type === 'live' || data.type === 'you' ? 'now' : timeAgo(data.connectedAt)}
            </span>
          </div>

          <div className="text-white/90 text-[12px] font-display font-semibold">
            {data.city}{data.region ? `, ${data.region}` : ''}
          </div>
          <div className="text-white/50 text-[10px] font-display mt-0.5">
            {data.country}
          </div>

          {(data.timezone || data.isp || data.lat != null) && (
            <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
              {data.timezone && (
                <div className="flex items-center justify-between">
                  <span className="text-white/25 text-[9px] font-mono uppercase">Timezone</span>
                  <span className="text-white/50 text-[9px] font-mono">{data.timezone}</span>
                </div>
              )}
              {data.isp && (
                <div className="flex items-center justify-between">
                  <span className="text-white/25 text-[9px] font-mono uppercase">ISP</span>
                  <span className="text-white/50 text-[9px] font-mono truncate ml-3 max-w-[140px]">{data.isp}</span>
                </div>
              )}
              {data.lat != null && data.lng != null && (
                <div className="flex items-center justify-between">
                  <span className="text-white/25 text-[9px] font-mono uppercase">Coords</span>
                  <span className="text-white/50 text-[9px] font-mono">{data.lat.toFixed(2)}°, {data.lng.toFixed(2)}°</span>
                </div>
              )}
              {data.ip && (
                <div className="flex items-center justify-between">
                  <span className="text-white/25 text-[9px] font-mono uppercase">IP</span>
                  <span className="text-[9px] font-mono" style={{ color: `${color}99` }}>{data.ip}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

export function Globe3D({ visitors, currentVisitorId, historicalVisitors, showAllTime }: Globe3DProps) {
  const globeRef = useRef<THREE.Group>(null);
  const [labelPositions, setLabelPositions] = useState<Record<string, { x: number; y: number; visible: boolean }>>({});
  const [tooltip, setTooltip] = useState<PinTooltipData | null>(null);

  const handlePositionUpdate = useCallback((id: string, pos: { x: number; y: number; visible: boolean }) => {
    setLabelPositions(prev => {
      const existing = prev[id];
      if (existing && 
          Math.abs(existing.x - pos.x) < 1 && 
          Math.abs(existing.y - pos.y) < 1 &&
          existing.visible === pos.visible) {
        return prev;
      }
      return { ...prev, [id]: pos };
    });
  }, []);

  const handlePinClick = useCallback((data: PinTooltipData) => {
    setTooltip(data);
    setTimeout(() => setTooltip(null), 8000);
  }, []);

  const currentLabelPos = currentVisitorId ? labelPositions[currentVisitorId] : null;

  return (
    <motion.div 
      className="w-full h-full relative"
      style={{ width: '100%', height: '100%', minHeight: '300px' }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <div 
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(circle at center, transparent 30%, rgba(5,5,10,0.8) 100%)',
        }}
      />

      <Canvas 
        camera={{ position: [0, 0, 5.5], fov: 45 }}
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        style={{ width: '100%', height: '100%' }}
        onPointerMissed={() => setTooltip(null)}
      >
        <GlobeScene 
          visitors={visitors}
          currentVisitorId={currentVisitorId}
          globeRef={globeRef}
          onPositionUpdate={handlePositionUpdate}
          historicalVisitors={historicalVisitors}
          showAllTime={showAllTime}
          onPinClick={handlePinClick}
        />
      </Canvas>

      {currentLabelPos && (
        <FloatingLabel x={currentLabelPos.x} y={currentLabelPos.y} visible={currentLabelPos.visible} />
      )}

      {tooltip && (
        <PinTooltip data={tooltip} onClose={() => setTooltip(null)} />
      )}
    </motion.div>
  );
}
