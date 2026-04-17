import { useCallback } from 'react';
import { useProfileStore } from '../store/useProfileStore';

// API response types matching server
interface AIAnalysisResult {
  humanScore: number;
  fraudRisk: number;
  deviceTier: string;
  deviceValue: string;
  ageRange: string;
  incomeLevel: string;
  occupation: string;
  education: string;
  lifeSituation: string;
  workStyle: string;
  personalLife: {
    relationshipStatus: string;
    hasChildren: string;
    livingArrangement: string;
    petOwner: string;
  };
  mentalState: {
    currentMood: string;
    stressLevel: string;
    focusLevel: string;
  };
  lifestyle: {
    sleepSchedule: string;
    workLifeBalance: string;
    techAttitude: string;
  };
  interests: string[];
  creepyInsights: string[];
  profileSummary: string;
  confidence: number;
}

interface APIResponse {
  success: boolean;
  analysis?: AIAnalysisResult;
  error?: string;
  fallback?: boolean;
}

// Determine API base URL
function getAPIBaseURL(): string {
  // Allow explicit override via env variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In development, server runs on port 3001
  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }
  
  // In production, use relative path (same origin)
  return '';
}

export function useAIAnalysis() {
  const {
    hardware,
    network,
    browser,
    fingerprints,
    botDetection,
    behavioral,
    trackingDetection,
    cryptoWallets,
    socialLogins,
    vpnDetection,
    systemPreferences,
    setAIAnalysis,
    setPersonalLife,
    setMentalPhysical,
    setLifestyle,
    setCreepyInsights,
    setInferredInterests,
    addConsoleEntry,
  } = useProfileStore();

  const runAIAnalysis = useCallback(async (): Promise<boolean> => {
    addConsoleEntry('SCAN', 'Initiating data-driven heuristic analysis...');

    // Build the data payload
    const now = new Date();
    const walletsList: string[] = [];
    if (cryptoWallets.metamask) walletsList.push('MetaMask');
    if (cryptoWallets.phantom) walletsList.push('Phantom');
    if (cryptoWallets.coinbase) walletsList.push('Coinbase');
    if (cryptoWallets.braveWallet) walletsList.push('Brave Wallet');
    if (cryptoWallets.trustWallet) walletsList.push('Trust Wallet');
    if (cryptoWallets.solflare) walletsList.push('Solflare');
    if (cryptoWallets.tronLink) walletsList.push('TronLink');

    // Get storage info
    const storage = useProfileStore.getState().storage;
    
    // Build social logins list
    const socialLoginsList: string[] = [];
    if (socialLogins.google) socialLoginsList.push('Google');
    if (socialLogins.facebook) socialLoginsList.push('Facebook');
    if (socialLogins.twitter) socialLoginsList.push('Twitter');
    if (socialLogins.github) socialLoginsList.push('GitHub');
    if (socialLogins.reddit) socialLoginsList.push('Reddit');
    
    const payload = {
      hardware: {
        gpu: hardware.gpu,
        gpuVendor: hardware.gpuVendor,
        cpuCores: hardware.cpuCores,
        ram: hardware.ram,
        battery: hardware.battery,
        screenWidth: hardware.screenWidth,
        screenHeight: hardware.screenHeight,
        pixelRatio: hardware.pixelRatio,
        touchSupport: hardware.touchSupport,
        maxTouchPoints: hardware.maxTouchPoints,
        colorDepth: hardware.colorDepth,
        orientation: hardware.orientation,
      },
      network: {
        city: network.city,
        region: network.region,
        country: network.country,
        isp: network.isp,
        timezone: network.timezone,
        connectionType: network.connectionType,
        downlink: network.downlink,
        rtt: network.rtt,
      },
      browser: {
        userAgent: browser.userAgent,
        language: browser.language,
        languages: browser.languages,
        platform: browser.platform,
        mobile: browser.mobile,
        historyLength: browser.historyLength,
        cookiesEnabled: browser.cookiesEnabled,
        vendor: browser.vendor,
        referrer: browser.referrer,
        pdfViewer: browser.pdfViewer,
        architecture: browser.architecture,
        platformVersion: browser.platformVersion,
      },
      fingerprints: {
        fontsDetected: fingerprints.fontsDetected,
        extensionsDetected: fingerprints.extensionsDetected,
        hardwareFamily: fingerprints.hardwareFamily,
        webgpuAvailable: fingerprints.webgpuAvailable,
        wasmSupported: fingerprints.wasmSupported,
        speechVoices: fingerprints.speechVoices,
        navigatorProps: fingerprints.navigatorProps,
        windowProps: fingerprints.windowProps,
      },
      botDetection: {
        isAutomated: botDetection.isAutomated,
        isHeadless: botDetection.isHeadless,
        isVirtualMachine: botDetection.isVirtualMachine,
        incognitoMode: botDetection.incognitoMode,
        devToolsOpen: botDetection.devToolsOpen,
      },
      behavioral: {
        typing: {
          totalKeystrokes: behavioral.typing.totalKeystrokes,
          averageWPM: behavioral.typing.averageWPM,
          averageHoldTime: behavioral.typing.averageHoldTime,
        },
        mouse: {
          totalClicks: behavioral.mouse.totalClicks,
          rageClicks: behavioral.mouse.rageClicks,
          erraticMovements: behavioral.mouse.erraticMovements,
          movements: behavioral.mouse.movements,
          totalDistance: behavioral.mouse.totalDistance,
          averageVelocity: behavioral.mouse.averageVelocity,
        },
        scroll: {
          scrollEvents: behavioral.scroll.scrollEvents,
          maxDepth: behavioral.scroll.maxDepth,
          directionChanges: behavioral.scroll.directionChanges,
        },
        attention: {
          tabSwitches: behavioral.attention.tabSwitches,
          totalHiddenTime: behavioral.attention.totalHiddenTime,
          focusTime: behavioral.attention.focusTime,
        },
        emotions: {
          engagement: behavioral.emotions.engagement,
          exitIntents: behavioral.emotions.exitIntents,
          handedness: behavioral.emotions.handedness,
        },
      },
      tracking: {
        adBlocker: trackingDetection.adBlocker,
        doNotTrack: trackingDetection.doNotTrack,
        globalPrivacyControl: trackingDetection.globalPrivacyControl || false,
      },
      crypto: {
        hasAnyWallet: cryptoWallets.hasAnyWallet,
        wallets: walletsList,
      },
      socialLogins: {
        hasAny: socialLoginsList.length > 0,
        services: socialLoginsList,
      },
      vpn: {
        likely: vpnDetection.likelyUsingVPN,
        timezoneMismatch: vpnDetection.timezoneMismatch,
        webrtcLeak: vpnDetection.webrtcLeak,
      },
      preferences: {
        colorScheme: systemPreferences.colorScheme,
        reducedMotion: systemPreferences.reducedMotion,
        colorGamut: systemPreferences.colorGamut,
        hdrSupport: systemPreferences.hdrSupport,
      },
      currentTime: {
        hour: now.getHours(),
        dayOfWeek: now.getDay(),
        isWeekend: now.getDay() === 0 || now.getDay() === 6,
        localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      storage: {
        quota: storage.quota,
        used: storage.used,
        usagePercent: storage.usagePercent,
      },
    };

    try {
      const baseURL = getAPIBaseURL();
      const response = await fetch(`${baseURL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_KEY ?? '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result: APIResponse = await response.json();

      if (!result.success || !result.analysis) {
        addConsoleEntry('ALERT', 'Analysis returned no data');
        return false;
      }

      const analysis = result.analysis;

      // Update all the stores with AI analysis results
      setAIAnalysis({
        humanScore: analysis.humanScore,
        fraudRisk: analysis.fraudRisk,
        deviceTier: analysis.deviceTier as 'low-end' | 'mid-range' | 'high-end' | 'premium',
        deviceValue: analysis.deviceValue,
        incomeLevel: analysis.incomeLevel as 'low' | 'medium' | 'high' | 'unknown',
        ageRange: analysis.ageRange,
        occupation: analysis.occupation,
        education: analysis.education,
        workStyle: analysis.workStyle,
        lifeSituation: analysis.lifeSituation,
      });

      setPersonalLife({
        parent: analysis.personalLife.hasChildren,
        petOwner: analysis.personalLife.petOwner,
        homeowner: analysis.personalLife.livingArrangement,
        carOwner: 'Unknown',
        socialType: analysis.personalLife.relationshipStatus,
      });

      setMentalPhysical({
        stressLevel: analysis.mentalState.stressLevel.includes('high') ? 'high' :
                     analysis.mentalState.stressLevel.includes('medium') ? 'medium' : 'low',
        sleepSchedule: analysis.lifestyle.sleepSchedule.toLowerCase().includes('night') ? 'late' :
                       analysis.lifestyle.sleepSchedule.toLowerCase().includes('early') ? 'early' : 'normal',
        fitnessLevel: 'unknown',
        healthConscious: analysis.mentalState.currentMood,
      });

      setLifestyle({
        caffeine: 'unknown',
        drinksAlcohol: 'unknown',
        smokes: 'unknown',
        travel: analysis.lifestyle.workLifeBalance,
      });

      setCreepyInsights({
        insights: analysis.creepyInsights,
      });

      setInferredInterests({
        cryptocurrency: analysis.interests.some(i => i.toLowerCase().includes('crypto')) ? 'Likely interested' : 'Unknown',
        privacy: analysis.interests.some(i => i.toLowerCase().includes('privacy')) ? 'Likely interested' : 'Unknown',
        modernWebTechnologies: analysis.interests.some(i => i.toLowerCase().includes('tech') || i.toLowerCase().includes('dev')) ? 'Likely interested' : 'Unknown',
        gaming: analysis.interests.some(i => i.toLowerCase().includes('gaming') || i.toLowerCase().includes('game')) ? 'Likely interested' : 'Unknown',
        design: analysis.interests.some(i => i.toLowerCase().includes('design')) ? 'Likely interested' : 'Unknown',
        development: analysis.interests.some(i => i.toLowerCase().includes('develop') || i.toLowerCase().includes('program')) ? 'Likely interested' : 'Unknown',
      });

      // Store the full analysis and summary in the store for the profile card
      useProfileStore.setState({
        aiProfileSummary: analysis.profileSummary,
        aiConfidence: analysis.confidence,
        aiInterests: analysis.interests,
        aiFallback: false, // Always using local heuristics now
      });

      addConsoleEntry('DATA', `Local heuristic analysis complete (${analysis.confidence}% confidence)`);
      addConsoleEntry('DATA', `Profile: ${analysis.profileSummary.substring(0, 80)}...`);

      return true;
    } catch (error) {
      addConsoleEntry('ALERT', `Analysis failed: ${error}`);
      console.error('Analysis error:', error);
      return false;
    }
  }, [
    hardware, network, browser, fingerprints, botDetection, behavioral,
    trackingDetection, cryptoWallets, setAIAnalysis, setPersonalLife,
    setMentalPhysical, setLifestyle, setCreepyInsights, setInferredInterests,
    addConsoleEntry,
  ]);

  return { runAIAnalysis };
}
