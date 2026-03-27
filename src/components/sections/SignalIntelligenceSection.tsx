import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Radio, Heart, Eye, Signal, Waves } from 'lucide-react';
import { useProfileStore } from '../../store/useProfileStore';
import { DataSection, DataRow, StatusRow } from '../ui/DataSection';

// ============================================
// SIGNAL INTELLIGENCE - Inspired by WiFi DensePose
// ============================================

// Simulated WiFi network data generator
function generateNearbyNetworks(seed: number) {
  const rng = (i: number) => ((seed * 9301 + 49297 + i * 233) % 233280) / 233280;
  const ssids = [
    'Home-WiFi-5G', 'NETGEAR72', 'xfinitywifi', 'ATT-WIFI-832',
    'TP-Link_AE48', 'Linksys00042', 'HP-Print-7B', 'ChromeCast-Ultra',
    'Ring-Doorbell', 'Nest-Thermostat', 'Samsung-TV-UHD', 'IoT-Bridge-001',
    'Guest_Network', 'DIRECT-roku', 'Amazon-Echo-PWR', 'Sonos-Kitchen',
  ];

  return ssids.slice(0, Math.floor(rng(0) * 6 + 8)).map((ssid, i) => ({
    ssid,
    bssid: `${Math.floor(rng(i + 10) * 255).toString(16).padStart(2, '0')}:${Math.floor(rng(i + 20) * 255).toString(16).padStart(2, '0')}:${Math.floor(rng(i + 30) * 255).toString(16).padStart(2, '0')}:${Math.floor(rng(i + 40) * 255).toString(16).padStart(2, '0')}:${Math.floor(rng(i + 50) * 255).toString(16).padStart(2, '0')}:${Math.floor(rng(i + 60) * 255).toString(16).padStart(2, '0')}`,
    signal: -Math.floor(rng(i + 70) * 60 + 30), // -30 to -90 dBm
    channel: [1, 6, 11, 36, 40, 44, 48, 149, 153][Math.floor(rng(i + 80) * 9)],
    security: ['WPA3', 'WPA2', 'WPA2', 'WPA2', 'WEP', 'Open'][Math.floor(rng(i + 90) * 6)],
    frequency: rng(i + 100) > 0.4 ? '5 GHz' : '2.4 GHz',
    isIoT: ssid.includes('Ring') || ssid.includes('Nest') || ssid.includes('Echo') || ssid.includes('Sonos') || ssid.includes('HP-Print') || ssid.includes('ChromeCast') || ssid.includes('IoT') || ssid.includes('Samsung-TV'),
  }));
}

// WiFi Network Scanner
export function WiFiScannerSection() {
  const network = useProfileStore((s) => s.network);
  const [scanning, setScanning] = useState(true);
  const [networks, setNetworks] = useState<ReturnType<typeof generateNearbyNetworks>>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const seed = (network.ip || 'default').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      setNetworks(generateNearbyNetworks(seed));
      setScanning(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [network.ip]);

  const iotDevices = networks.filter(n => n.isIoT);
  const vulnerableNetworks = networks.filter(n => n.security === 'WEP' || n.security === 'Open');

  return (
    <DataSection
      title="WiFi Reconnaissance"
      icon={<Wifi size={14} />}
      badge={
        !scanning ? (
          <span className="text-[9px] font-mono text-cyber-cyan bg-cyan-500/10 px-2 py-0.5 rounded">
            {networks.length} NETWORKS
          </span>
        ) : (
          <span className="text-[9px] font-mono text-amber-400 animate-pulse">SCANNING...</span>
        )
      }
    >
      {scanning ? (
        <div className="py-4 text-center">
          <Radio size={20} className="text-cyber-cyan mx-auto mb-2 animate-pulse" />
          <p className="text-white/30 text-[10px] font-mono">Scanning RF spectrum...</p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2 mb-3 pb-3 border-b border-white/5">
            <div className="text-center p-2 rounded-lg bg-white/[0.02]">
              <span className="text-cyber-cyan font-mono text-sm font-bold">{networks.length}</span>
              <span className="text-white/30 text-[8px] uppercase block mt-0.5">Total</span>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/[0.02]">
              <span className="text-amber-400 font-mono text-sm font-bold">{iotDevices.length}</span>
              <span className="text-white/30 text-[8px] uppercase block mt-0.5">IoT</span>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/[0.02]">
              <span className="text-rose-400 font-mono text-sm font-bold">{vulnerableNetworks.length}</span>
              <span className="text-white/30 text-[8px] uppercase block mt-0.5">Vulnerable</span>
            </div>
          </div>

          {/* Network list */}
          {networks.map((n, i) => (
            <motion.div
              key={n.bssid}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Signal size={10} className={n.signal > -50 ? 'text-emerald-400' : n.signal > -70 ? 'text-amber-400' : 'text-rose-400'} />
                <div className="min-w-0">
                  <span className={`text-[11px] block truncate ${n.isIoT ? 'text-amber-400/80' : 'text-white/70'}`}>
                    {n.ssid}
                  </span>
                  <span className="text-[8px] font-mono text-white/20 block">{n.bssid}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[8px] font-mono text-white/30">{n.frequency}</span>
                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${
                  n.security === 'Open' ? 'text-rose-400 bg-rose-500/10' :
                  n.security === 'WEP' ? 'text-amber-400 bg-amber-500/10' :
                  'text-emerald-400/60 bg-emerald-500/10'
                }`}>
                  {n.security}
                </span>
                <span className="text-[9px] font-mono text-white/40 w-[42px] text-right">{n.signal}dBm</span>
              </div>
            </motion.div>
          ))}
        </>
      )}
    </DataSection>
  );
}

// Presence Detection Simulator
export function PresenceDetectionSection() {
  const behavioral = useProfileStore((s) => s.behavioral);
  const [presenceData, setPresenceData] = useState({
    detected: false,
    confidence: 0,
    distance: '0m',
    bodyOrientation: 'Unknown',
    movementState: 'Unknown',
    occupants: 0,
  });

  useEffect(() => {
    // "Detect" presence from behavioral data
    const hasActivity = behavioral.mouse.totalClicks > 0 || behavioral.typing.totalKeystrokes > 0;
    const isActive = behavioral.attention.isVisible;
    const movement = behavioral.mouse.averageVelocity;

    const timer = setTimeout(() => {
      setPresenceData({
        detected: true,
        confidence: hasActivity ? Math.min(95, 60 + behavioral.mouse.totalClicks * 2 + behavioral.typing.totalKeystrokes) : 30,
        distance: hasActivity ? `${(Math.random() * 2 + 0.3).toFixed(1)}m` : '>5m',
        bodyOrientation: isActive ? 'Facing screen' : 'Away',
        movementState: movement > 50 ? 'Active movement' : movement > 10 ? 'Subtle motion' : 'Stationary',
        occupants: Math.floor(Math.random() * 2) + 1,
      });
    }, 4000);
    return () => clearTimeout(timer);
  }, [behavioral.mouse.totalClicks, behavioral.typing.totalKeystrokes, behavioral.attention.isVisible, behavioral.mouse.averageVelocity]);

  return (
    <DataSection
      title="Presence Detection"
      icon={<Eye size={14} />}
      badge={
        presenceData.detected ? (
          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded animate-pulse">
            DETECTED
          </span>
        ) : (
          <span className="text-[9px] font-mono text-white/30">CALIBRATING</span>
        )
      }
    >
      <div className="mb-3 pb-3 border-b border-white/5">
        <p className="text-[9px] font-mono text-white/30 leading-relaxed">
          WiFi CSI (Channel State Information) analysis detects human presence through radio signal disturbance patterns. No cameras required.
        </p>
      </div>

      <StatusRow label="Human Detected" detected={presenceData.detected} />
      <DataRow label="Confidence" value={`${presenceData.confidence}%`} valueColor={presenceData.confidence > 70 ? 'text-emerald-400' : 'text-amber-400'} />
      <DataRow label="Est. Distance" value={presenceData.distance} />
      <DataRow label="Orientation" value={presenceData.bodyOrientation} />
      <DataRow label="Movement State" value={presenceData.movementState} />
      <DataRow label="Occupants in Room" value={presenceData.occupants} />
    </DataSection>
  );
}

// Vital Signs Inference from behavioral data
export function VitalSignsSection() {
  const behavioral = useProfileStore((s) => s.behavioral);
  const [vitals, setVitals] = useState({
    heartRate: 0,
    breathingRate: 0,
    stressIndex: 0,
    fatigueLevel: 'Unknown',
    posture: 'Unknown',
  });

  // Animated heart rate counter
  const [displayHR, setDisplayHR] = useState(0);
  const [displayBR, setDisplayBR] = useState(0);

  useEffect(() => {
    // Infer vitals from behavioral patterns
    const rageClicks = behavioral.mouse.rageClicks;
    const erratic = behavioral.mouse.erraticMovements;
    const wpm = behavioral.typing.averageWPM;
    const tabSwitches = behavioral.attention.tabSwitches;
    const isVisible = behavioral.attention.isVisible;

    // Heart rate inference: stressed users → higher HR
    const baseHR = 72;
    const stressModifier = rageClicks * 3 + erratic * 2 + tabSwitches * 1.5;
    const activityModifier = wpm > 60 ? 8 : wpm > 30 ? 4 : 0;
    const inferredHR = Math.min(120, Math.max(55, baseHR + stressModifier + activityModifier + (Math.random() * 6 - 3)));

    // Breathing rate: normally 12-20 BPM
    const baseBR = 15;
    const stressBR = Math.min(28, baseBR + stressModifier * 0.3 + (Math.random() * 2 - 1));

    // Stress index 0-100
    const stressIndex = Math.min(100, Math.floor(stressModifier * 4 + (wpm > 80 ? 15 : 0)));

    // Fatigue: based on session time and activity patterns
    const sessionMinutes = (Date.now() - behavioral.attention.sessionStart) / 60000;
    const fatigueLevel = sessionMinutes > 60 ? 'High' : sessionMinutes > 30 ? 'Moderate' : sessionMinutes > 10 ? 'Low' : 'Fresh';

    // Posture from device orientation
    const posture = isVisible ? 'Upright / Leaning forward' : 'Away from device';

    setVitals({
      heartRate: Math.round(inferredHR),
      breathingRate: Math.round(stressBR),
      stressIndex,
      fatigueLevel,
      posture,
    });
  }, [
    behavioral.mouse.rageClicks, behavioral.mouse.erraticMovements,
    behavioral.typing.averageWPM, behavioral.attention.tabSwitches,
    behavioral.attention.isVisible, behavioral.attention.sessionStart,
  ]);

  // Animate counters
  useEffect(() => {
    if (vitals.heartRate === 0) return;
    const hrInterval = setInterval(() => {
      setDisplayHR(prev => {
        if (prev < vitals.heartRate) return prev + 1;
        if (prev > vitals.heartRate) return prev - 1;
        return prev;
      });
    }, 30);
    const brInterval = setInterval(() => {
      setDisplayBR(prev => {
        if (prev < vitals.breathingRate) return prev + 1;
        if (prev > vitals.breathingRate) return prev - 1;
        return prev;
      });
    }, 50);
    return () => { clearInterval(hrInterval); clearInterval(brInterval); };
  }, [vitals.heartRate, vitals.breathingRate]);

  // Pulsing animation for heart rate
  const pulseRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (displayHR <= 0) return;
    const intervalMs = 60000 / displayHR;
    const pulse = setInterval(() => {
      if (pulseRef.current) {
        pulseRef.current.style.transform = 'scale(1.15)';
        setTimeout(() => {
          if (pulseRef.current) pulseRef.current.style.transform = 'scale(1)';
        }, 150);
      }
    }, intervalMs);
    return () => clearInterval(pulse);
  }, [displayHR]);

  return (
    <DataSection
      title="Vital Signs Oracle"
      icon={<Heart size={14} />}
      badge={
        <span className="text-[9px] font-mono text-rose-400/70 bg-rose-500/10 px-2 py-0.5 rounded">
          INFERRED
        </span>
      }
    >
      <div className="mb-3 pb-3 border-b border-white/5">
        <p className="text-[9px] font-mono text-white/30 leading-relaxed">
          Physiological state estimated from behavioral micro-signals: keystroke dynamics, mouse tremor, interaction cadence.
        </p>
      </div>

      {/* Heart rate & breathing visual */}
      <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-white/5">
        <div className="text-center p-3 rounded-lg bg-white/[0.02]">
          <div ref={pulseRef} className="transition-transform duration-150">
            <Heart size={16} className="text-rose-400 mx-auto mb-1" />
          </div>
          <span className="text-rose-400 font-mono text-lg font-bold">{displayHR || '--'}</span>
          <span className="text-white/30 text-[8px] uppercase block mt-0.5">BPM</span>
        </div>
        <div className="text-center p-3 rounded-lg bg-white/[0.02]">
          <Waves size={16} className="text-cyan-400 mx-auto mb-1" />
          <span className="text-cyan-400 font-mono text-lg font-bold">{displayBR || '--'}</span>
          <span className="text-white/30 text-[8px] uppercase block mt-0.5">Breaths/min</span>
        </div>
      </div>

      <DataRow label="Heart Rate" value={vitals.heartRate > 0 ? `${vitals.heartRate} BPM` : 'Calculating...'} valueColor={
        vitals.heartRate > 100 ? 'text-rose-400' : vitals.heartRate > 85 ? 'text-amber-400' : 'text-emerald-400'
      } />
      <DataRow label="Breathing Rate" value={vitals.breathingRate > 0 ? `${vitals.breathingRate} BPM` : 'Calculating...'} />
      <DataRow label="Stress Index" value={`${vitals.stressIndex}/100`} valueColor={
        vitals.stressIndex > 60 ? 'text-rose-400' : vitals.stressIndex > 30 ? 'text-amber-400' : 'text-emerald-400'
      } />
      <DataRow label="Fatigue Level" value={vitals.fatigueLevel} valueColor={
        vitals.fatigueLevel === 'High' ? 'text-rose-400' : vitals.fatigueLevel === 'Moderate' ? 'text-amber-400' : 'text-emerald-400'
      } />
      <DataRow label="Posture" value={vitals.posture} />
    </DataSection>
  );
}

// Signal Observatory Panel (holographic aesthetic)
export function SignalObservatorySection() {
  const network = useProfileStore((s) => s.network);
  const [subcarriers, setSubcarriers] = useState<number[]>([]);
  const [phaseData, setPhaseData] = useState<{ x: number; y: number }[]>([]);

  useEffect(() => {
    // Generate simulated subcarrier amplitude data
    const generateSubcarriers = () => {
      return Array.from({ length: 52 }, (_, i) => {
        const base = Math.sin(i * 0.3) * 20 + 40;
        return base + Math.random() * 15 - 7.5;
      });
    };

    // Generate phase constellation points
    const generatePhase = () => {
      return Array.from({ length: 24 }, () => ({
        x: Math.random() * 200 - 100,
        y: Math.random() * 200 - 100,
      }));
    };

    setSubcarriers(generateSubcarriers());
    setPhaseData(generatePhase());

    const interval = setInterval(() => {
      setSubcarriers(generateSubcarriers());
      setPhaseData(generatePhase());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <DataSection
      title="Signal Observatory"
      icon={<Radio size={14} />}
      badge={
        <span className="text-[9px] font-mono text-violet-400/70 bg-violet-500/10 px-2 py-0.5 rounded">
          LIVE
        </span>
      }
    >
      {/* Subcarrier Manifold visualization */}
      <div className="mb-3">
        <span className="text-[8px] font-mono text-white/25 uppercase tracking-wider">Subcarrier Manifold</span>
        <div className="mt-1 h-16 flex items-end gap-[2px] overflow-hidden rounded bg-white/[0.02] p-1">
          {subcarriers.map((val, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-t-sm"
              style={{
                background: `linear-gradient(to top, rgba(139,92,246,0.3), rgba(0,240,255,${val / 80}))`,
              }}
              initial={{ height: 0 }}
              animate={{ height: `${val}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          ))}
        </div>
      </div>

      {/* Phase Constellation */}
      <div className="mb-3">
        <span className="text-[8px] font-mono text-white/25 uppercase tracking-wider">Phase Constellation</span>
        <div className="mt-1 h-24 relative overflow-hidden rounded bg-white/[0.02] p-1">
          {/* Grid lines */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute w-full h-[1px] bg-white/5" />
            <div className="absolute h-full w-[1px] bg-white/5" />
          </div>
          {/* Phase points */}
          {phaseData.map((p, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-cyber-cyan"
              style={{
                left: `${50 + p.x / 2.5}%`,
                top: `${50 + p.y / 2.5}%`,
                boxShadow: '0 0 4px rgba(0,240,255,0.5)',
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 0.7, scale: 1 }}
              transition={{ delay: i * 0.02, duration: 0.3 }}
            />
          ))}
        </div>
      </div>

      <DataRow label="Connection Type" value={network.connectionType || 'Unknown'} />
      <DataRow label="Downlink" value={network.downlink ? `${network.downlink} Mbps` : null} />
      <DataRow label="RTT" value={network.rtt ? `${network.rtt}ms` : null} />
      <DataRow label="Data Saver" value={network.dataSaver ? 'Enabled' : 'Disabled'} />
    </DataSection>
  );
}

// Combined Signal Intelligence Section
export function SignalIntelligenceFullSection() {
  return (
    <>
      <WiFiScannerSection />
      <PresenceDetectionSection />
      <VitalSignsSection />
      <SignalObservatorySection />
    </>
  );
}
