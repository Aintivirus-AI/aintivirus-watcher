/**
 * Enhanced User Profiling Engine
 *
 * DISCLAIMER: All demographic inferences produced by this module are
 * probabilistic estimates for educational demonstration purposes only.
 * They are NOT definitive determinations about any individual. Outputs
 * should be treated as illustrative examples of statistical correlations,
 * not as facts about any specific user. Review for compliance with GDPR
 * Article 22 (automated individual decision-making) and CCPA before use
 * in any production context.
 *
 * This module implements techniques similar to those used by large tech companies
 * to create accurate user profiles from browser signals. It uses multi-signal
 * correlation, probabilistic scoring, and extensive lookup databases.
 */

import type {
  HardwareData,
  NetworkData,
  BrowserData,
  BehavioralData,
  FingerprintData,
  CryptoWallets,
  SocialLogins,
  TrackingDetection,
  BotDetectionData,
  SystemPreferences,
} from '../store/useProfileStore';

// ============================================
// ENHANCED LOOKUP DATABASES
// ============================================

// Extension to profile mapping
const EXTENSION_PROFILES: Record<string, { profile: string; weight: number; income_mod?: number }[]> = {
  'React DevTools': [{ profile: 'developer', weight: 40 }, { profile: 'frontend_dev', weight: 30 }],
  'Vue DevTools': [{ profile: 'developer', weight: 40 }, { profile: 'frontend_dev', weight: 30 }],
  'Redux DevTools': [{ profile: 'developer', weight: 35 }, { profile: 'frontend_dev', weight: 25 }],
  'Grammarly': [{ profile: 'writer', weight: 25 }, { profile: 'professional', weight: 15 }],
  'LastPass': [{ profile: 'security_conscious', weight: 20 }, { profile: 'professional', weight: 15 }],
  '1Password': [{ profile: 'security_conscious', weight: 25 }, { profile: 'high_income', weight: 15, income_mod: 10 }],
  'Dashlane': [{ profile: 'security_conscious', weight: 20 }, { profile: 'high_income', weight: 10, income_mod: 8 }],
  'Bitwarden': [{ profile: 'security_conscious', weight: 20 }, { profile: 'tech_savvy', weight: 15 }],
  'Honey': [{ profile: 'budget_conscious', weight: 25, income_mod: -5 }],
};

// Language code to demographic mapping
const LANGUAGE_DEMOGRAPHICS: Record<string, { 
  region: string; 
  education_level: string;
  tech_adoption: number; // 0-100
  avg_income_tier: number; // 1-5
  professional_likelihood: string[];
}> = {
  'en-US': { region: 'North America', education_level: 'varies', tech_adoption: 75, avg_income_tier: 4, professional_likelihood: ['tech', 'business', 'finance'] },
  'en-GB': { region: 'UK', education_level: 'higher_average', tech_adoption: 70, avg_income_tier: 4, professional_likelihood: ['finance', 'tech', 'media'] },
  'en-AU': { region: 'Australia', education_level: 'higher_average', tech_adoption: 72, avg_income_tier: 4, professional_likelihood: ['tech', 'mining', 'finance'] },
  'en-IN': { region: 'India', education_level: 'high_tech', tech_adoption: 80, avg_income_tier: 2, professional_likelihood: ['tech', 'it_services', 'engineering'] },
  'de-DE': { region: 'Germany', education_level: 'high', tech_adoption: 65, avg_income_tier: 4, professional_likelihood: ['engineering', 'manufacturing', 'tech'] },
  'ja-JP': { region: 'Japan', education_level: 'high', tech_adoption: 70, avg_income_tier: 4, professional_likelihood: ['tech', 'gaming', 'electronics'] },
  'zh-CN': { region: 'China', education_level: 'varies', tech_adoption: 85, avg_income_tier: 3, professional_likelihood: ['tech', 'manufacturing', 'finance'] },
  'ko-KR': { region: 'South Korea', education_level: 'very_high', tech_adoption: 90, avg_income_tier: 4, professional_likelihood: ['tech', 'gaming', 'electronics'] },
  'pt-BR': { region: 'Brazil', education_level: 'varies', tech_adoption: 65, avg_income_tier: 2, professional_likelihood: ['tech', 'finance', 'agriculture'] },
  'es-ES': { region: 'Spain', education_level: 'higher_average', tech_adoption: 60, avg_income_tier: 3, professional_likelihood: ['tourism', 'tech', 'retail'] },
  'fr-FR': { region: 'France', education_level: 'high', tech_adoption: 62, avg_income_tier: 4, professional_likelihood: ['fashion', 'tech', 'aerospace'] },
  'nl-NL': { region: 'Netherlands', education_level: 'very_high', tech_adoption: 80, avg_income_tier: 5, professional_likelihood: ['tech', 'finance', 'logistics'] },
  'sv-SE': { region: 'Sweden', education_level: 'very_high', tech_adoption: 85, avg_income_tier: 5, professional_likelihood: ['tech', 'gaming', 'design'] },
  'ru-RU': { region: 'Russia', education_level: 'high_stem', tech_adoption: 70, avg_income_tier: 2, professional_likelihood: ['tech', 'engineering', 'science'] },
};

// ISP classification with more granular data
const ISP_INTELLIGENCE: Record<string, {
  type: 'residential' | 'business' | 'enterprise' | 'mobile' | 'datacenter' | 'university';
  income_tier: number;
  tech_sophistication: number;
  likely_profession?: string[];
}> = {
  // US ISPs
  'comcast': { type: 'residential', income_tier: 3, tech_sophistication: 40 },
  'xfinity': { type: 'residential', income_tier: 3, tech_sophistication: 40 },
  'verizon fios': { type: 'residential', income_tier: 4, tech_sophistication: 55 },
  'at&t fiber': { type: 'residential', income_tier: 4, tech_sophistication: 50 },
  'google fiber': { type: 'residential', income_tier: 4, tech_sophistication: 70, likely_profession: ['tech'] },
  'spectrum': { type: 'residential', income_tier: 3, tech_sophistication: 40 },
  'cox': { type: 'residential', income_tier: 3, tech_sophistication: 40 },
  
  // Business ISPs
  'comcast business': { type: 'business', income_tier: 4, tech_sophistication: 60, likely_profession: ['business_owner', 'entrepreneur'] },
  'at&t business': { type: 'business', income_tier: 4, tech_sophistication: 60 },
  'verizon business': { type: 'enterprise', income_tier: 5, tech_sophistication: 70 },
  
  // Mobile carriers
  't-mobile': { type: 'mobile', income_tier: 3, tech_sophistication: 45 },
  'verizon wireless': { type: 'mobile', income_tier: 4, tech_sophistication: 50 },
  'at&t wireless': { type: 'mobile', income_tier: 4, tech_sophistication: 45 },
  
  // Cloud/Datacenter (likely VPN or developer)
  'amazon': { type: 'datacenter', income_tier: 4, tech_sophistication: 85, likely_profession: ['developer', 'tech'] },
  'google cloud': { type: 'datacenter', income_tier: 4, tech_sophistication: 90, likely_profession: ['developer', 'tech'] },
  'microsoft': { type: 'datacenter', income_tier: 4, tech_sophistication: 85, likely_profession: ['developer', 'tech'] },
  'digitalocean': { type: 'datacenter', income_tier: 4, tech_sophistication: 95, likely_profession: ['developer'] },
  'linode': { type: 'datacenter', income_tier: 4, tech_sophistication: 95, likely_profession: ['developer'] },
  'vultr': { type: 'datacenter', income_tier: 3, tech_sophistication: 90, likely_profession: ['developer'] },
  'cloudflare': { type: 'datacenter', income_tier: 4, tech_sophistication: 85, likely_profession: ['tech', 'developer'] },
  
  // Universities
  'university': { type: 'university', income_tier: 2, tech_sophistication: 65, likely_profession: ['student', 'academic', 'researcher'] },
  'edu': { type: 'university', income_tier: 2, tech_sophistication: 65, likely_profession: ['student', 'academic'] },
};

// Time-based behavior patterns
const TIME_PATTERNS = {
  // Hour patterns (24h) -> likely activity
  workaholic: { hours: [22, 23, 0, 1, 2, 5, 6], weekend_work: true },
  nine_to_five: { hours: [9, 10, 11, 12, 13, 14, 15, 16, 17], weekend_work: false },
  night_owl: { hours: [22, 23, 0, 1, 2, 3], weekend_work: false },
  early_bird: { hours: [5, 6, 7, 8], weekend_work: false },
  flexible: { hours: [10, 11, 14, 15, 16, 19, 20, 21], weekend_work: true },
  student: { hours: [10, 11, 12, 22, 23, 0, 1], weekend_work: false },
  parent: { hours: [6, 7, 8, 20, 21, 22], weekend_work: false }, // School hours + evening
};

// Screen resolution to device/user mapping
const SCREEN_INTELLIGENCE: Record<string, {
  device_type: string;
  likely_use: string;
  income_indicator: number;
  professional_indicator: number;
}> = {
  // High-end monitors
  '3840x2160': { device_type: '4K Monitor', likely_use: 'professional/gaming', income_indicator: 8, professional_indicator: 7 },
  '5120x2880': { device_type: '5K iMac/Display', likely_use: 'creative_professional', income_indicator: 9, professional_indicator: 9 },
  '6016x3384': { device_type: 'Pro Display XDR', likely_use: 'high_end_creative', income_indicator: 10, professional_indicator: 10 },
  '3440x1440': { device_type: 'Ultrawide', likely_use: 'productivity/gaming', income_indicator: 7, professional_indicator: 6 },
  '2560x1440': { device_type: 'QHD Monitor', likely_use: 'professional', income_indicator: 6, professional_indicator: 6 },
  
  // MacBook resolutions
  '2560x1600': { device_type: 'MacBook Pro 13/14"', likely_use: 'professional', income_indicator: 7, professional_indicator: 7 },
  '3024x1964': { device_type: 'MacBook Pro 14"', likely_use: 'professional', income_indicator: 8, professional_indicator: 8 },
  '3456x2234': { device_type: 'MacBook Pro 16"', likely_use: 'professional', income_indicator: 9, professional_indicator: 9 },
  
  // Standard
  '1920x1080': { device_type: 'Full HD', likely_use: 'general', income_indicator: 4, professional_indicator: 4 },
  '1366x768': { device_type: 'Budget Laptop', likely_use: 'casual/budget', income_indicator: 2, professional_indicator: 2 },
  '1280x720': { device_type: 'HD/Old', likely_use: 'budget/old', income_indicator: 1, professional_indicator: 1 },
  
  // Mobile
  '390x844': { device_type: 'iPhone 14', likely_use: 'mobile_primary', income_indicator: 6, professional_indicator: 5 },
  '430x932': { device_type: 'iPhone 15 Pro Max', likely_use: 'mobile_primary', income_indicator: 8, professional_indicator: 6 },
  '360x800': { device_type: 'Android Budget', likely_use: 'mobile_budget', income_indicator: 2, professional_indicator: 2 },
  '412x915': { device_type: 'Android Flagship', likely_use: 'mobile_flagship', income_indicator: 6, professional_indicator: 5 },
};

// City economic data (cost of living + tech hub status)
const CITY_INTELLIGENCE: Record<string, {
  cost_of_living: number; // 1-10
  tech_hub_score: number; // 1-10
  startup_density: number; // 1-10
  avg_income_multiplier: number;
  common_industries: string[];
}> = {
  'San Francisco': { cost_of_living: 10, tech_hub_score: 10, startup_density: 10, avg_income_multiplier: 1.8, common_industries: ['tech', 'finance', 'biotech'] },
  'New York': { cost_of_living: 10, tech_hub_score: 9, startup_density: 9, avg_income_multiplier: 1.7, common_industries: ['finance', 'media', 'tech'] },
  'Seattle': { cost_of_living: 8, tech_hub_score: 9, startup_density: 8, avg_income_multiplier: 1.5, common_industries: ['tech', 'aerospace', 'retail'] },
  'Austin': { cost_of_living: 6, tech_hub_score: 8, startup_density: 8, avg_income_multiplier: 1.3, common_industries: ['tech', 'music', 'government'] },
  'Boston': { cost_of_living: 8, tech_hub_score: 8, startup_density: 7, avg_income_multiplier: 1.4, common_industries: ['biotech', 'education', 'finance'] },
  'Los Angeles': { cost_of_living: 8, tech_hub_score: 7, startup_density: 7, avg_income_multiplier: 1.4, common_industries: ['entertainment', 'tech', 'aerospace'] },
  'Denver': { cost_of_living: 6, tech_hub_score: 7, startup_density: 7, avg_income_multiplier: 1.2, common_industries: ['tech', 'cannabis', 'aerospace'] },
  'London': { cost_of_living: 9, tech_hub_score: 9, startup_density: 8, avg_income_multiplier: 1.5, common_industries: ['finance', 'tech', 'media'] },
  'Berlin': { cost_of_living: 6, tech_hub_score: 8, startup_density: 9, avg_income_multiplier: 1.1, common_industries: ['tech', 'creative', 'startup'] },
  'Singapore': { cost_of_living: 8, tech_hub_score: 8, startup_density: 7, avg_income_multiplier: 1.5, common_industries: ['finance', 'tech', 'logistics'] },
  'Tokyo': { cost_of_living: 7, tech_hub_score: 8, startup_density: 6, avg_income_multiplier: 1.3, common_industries: ['tech', 'manufacturing', 'gaming'] },
  'Sydney': { cost_of_living: 8, tech_hub_score: 7, startup_density: 6, avg_income_multiplier: 1.3, common_industries: ['finance', 'tech', 'mining'] },
  'Amsterdam': { cost_of_living: 7, tech_hub_score: 8, startup_density: 8, avg_income_multiplier: 1.3, common_industries: ['tech', 'finance', 'logistics'] },
  'Toronto': { cost_of_living: 7, tech_hub_score: 8, startup_density: 7, avg_income_multiplier: 1.2, common_industries: ['finance', 'tech', 'film'] },
  'Bangalore': { cost_of_living: 3, tech_hub_score: 9, startup_density: 8, avg_income_multiplier: 0.6, common_industries: ['tech', 'it_services', 'startup'] },
  'Tel Aviv': { cost_of_living: 8, tech_hub_score: 9, startup_density: 10, avg_income_multiplier: 1.4, common_industries: ['tech', 'cybersecurity', 'startup'] },
};

// ============================================
// REFERRER & TRAFFIC SOURCE ANALYSIS
// ============================================

interface ReferrerAnalysis {
  source: string;
  medium: string;
  campaign?: string;
  searchQuery?: string;
  socialPlatform?: string;
  techIndicator: number; // 0-100
  ageIndicator: number; // modifier
  incomeIndicator: number; // modifier
  interests: string[];
  signals: string[];
}

/**
 * Deep referrer analysis - extracts insights from how the user arrived
 */
function analyzeReferrer(referrer: string): ReferrerAnalysis {
  const result: ReferrerAnalysis = {
    source: 'direct',
    medium: 'none',
    techIndicator: 0,
    ageIndicator: 0,
    incomeIndicator: 0,
    interests: [],
    signals: [],
  };
  
  if (!referrer || referrer === 'Direct') {
    result.signals.push('Direct visit or referrer blocked');
    return result;
  }
  
  const refLower = referrer.toLowerCase();
  
  try {
    const url = new URL(referrer);
    const hostname = url.hostname;
    const pathname = url.pathname;
    const params = url.searchParams;
    
    // UTM parameter extraction (marketing campaigns)
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');
    
    if (utmSource) {
      result.source = utmSource;
      result.signals.push(`UTM source: ${utmSource}`);
    }
    if (utmMedium) {
      result.medium = utmMedium;
      result.signals.push(`UTM medium: ${utmMedium}`);
    }
    if (utmCampaign) {
      result.campaign = utmCampaign;
      result.signals.push(`Campaign: ${utmCampaign}`);
    }
    
    // Search engine analysis
    if (hostname.includes('google.') || hostname.includes('bing.') || 
        hostname.includes('duckduckgo.') || hostname.includes('yahoo.')) {
      result.source = 'search';
      result.medium = 'organic';
      
      // Try to extract search query
      const query = params.get('q') || params.get('query') || params.get('p');
      if (query) {
        result.searchQuery = query;
        result.signals.push(`Search query: "${query}"`);
        
        // Analyze search query for interests
        const queryLower = query.toLowerCase();
        if (queryLower.includes('code') || queryLower.includes('programming') || queryLower.includes('developer')) {
          result.interests.push('development');
          result.techIndicator += 30;
        }
        if (queryLower.includes('crypto') || queryLower.includes('bitcoin') || queryLower.includes('ethereum')) {
          result.interests.push('cryptocurrency');
          result.techIndicator += 20;
        }
        if (queryLower.includes('design') || queryLower.includes('ui') || queryLower.includes('ux')) {
          result.interests.push('design');
        }
      }
      
      // DuckDuckGo users are privacy-conscious
      if (hostname.includes('duckduckgo.')) {
        result.techIndicator += 25;
        result.interests.push('privacy');
        result.signals.push('DuckDuckGo user (privacy-conscious)');
      }
    }
    
    // Social media analysis
    if (hostname.includes('reddit.com') || refLower.includes('reddit')) {
      result.source = 'social';
      result.medium = 'reddit';
      result.socialPlatform = 'reddit';
      result.techIndicator += 35;
      result.ageIndicator -= 8; // Reddit skews younger
      result.interests.push('internet_culture');
      result.signals.push('Came from Reddit');
      
      // Try to identify subreddit
      const subredditMatch = pathname.match(/\/r\/([^\/]+)/);
      if (subredditMatch) {
        const subreddit = subredditMatch[1].toLowerCase();
        result.signals.push(`From r/${subreddit}`);
        
        // Subreddit-based interests
        if (['programming', 'webdev', 'javascript', 'python', 'learnprogramming', 'cscareerquestions'].includes(subreddit)) {
          result.interests.push('development');
          result.techIndicator += 20;
          result.incomeIndicator += 10;
        }
        if (['cryptocurrency', 'bitcoin', 'ethereum', 'defi', 'solana'].includes(subreddit)) {
          result.interests.push('cryptocurrency');
          result.techIndicator += 15;
        }
        if (['privacy', 'privacytoolsio', 'degoogle'].includes(subreddit)) {
          result.interests.push('privacy');
          result.techIndicator += 25;
        }
        if (['gaming', 'pcgaming', 'buildapc', 'pcmasterrace'].includes(subreddit)) {
          result.interests.push('gaming');
          result.techIndicator += 15;
        }
        if (['personalfinance', 'investing', 'financialindependence', 'fire'].includes(subreddit)) {
          result.interests.push('finance');
          result.incomeIndicator += 15;
          result.ageIndicator += 5;
        }
      }
    }
    
    if (hostname.includes('news.ycombinator.com') || hostname.includes('hn.algolia.com')) {
      result.source = 'social';
      result.medium = 'hackernews';
      result.socialPlatform = 'hackernews';
      result.techIndicator += 50;
      result.incomeIndicator += 15;
      result.interests.push('technology', 'startups');
      result.signals.push('Came from Hacker News (tech professional)');
    }
    
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      result.source = 'social';
      result.medium = 'twitter';
      result.socialPlatform = 'twitter';
      result.techIndicator += 15;
      result.interests.push('news');
      result.signals.push('Came from Twitter/X');
    }
    
    if (hostname.includes('facebook.com') || hostname.includes('fb.com')) {
      result.source = 'social';
      result.medium = 'facebook';
      result.socialPlatform = 'facebook';
      result.ageIndicator += 10; // Facebook skews older
      result.signals.push('Came from Facebook');
    }
    
    if (hostname.includes('linkedin.com')) {
      result.source = 'social';
      result.medium = 'linkedin';
      result.socialPlatform = 'linkedin';
      result.incomeIndicator += 10;
      result.ageIndicator += 5;
      result.interests.push('career', 'professional_networking');
      result.signals.push('Came from LinkedIn (professional)');
    }
    
    if (hostname.includes('tiktok.com')) {
      result.source = 'social';
      result.medium = 'tiktok';
      result.socialPlatform = 'tiktok';
      result.ageIndicator -= 15; // TikTok skews much younger
      result.signals.push('Came from TikTok (younger demographic)');
    }
    
    if (hostname.includes('youtube.com')) {
      result.source = 'social';
      result.medium = 'youtube';
      result.socialPlatform = 'youtube';
      result.signals.push('Came from YouTube');
      
      // YouTube video parameter could tell us what they were watching
      const videoId = params.get('v');
      if (videoId) {
        result.signals.push('From YouTube video content');
      }
    }
    
    // Tech-specific sites
    if (hostname.includes('github.com') || hostname.includes('gitlab.com')) {
      result.source = 'tech';
      result.medium = 'repository';
      result.techIndicator += 60;
      result.incomeIndicator += 15;
      result.interests.push('development', 'open_source');
      result.signals.push('Came from GitHub/GitLab (developer)');
    }
    
    if (hostname.includes('stackoverflow.com') || hostname.includes('stackexchange.com')) {
      result.source = 'tech';
      result.medium = 'q&a';
      result.techIndicator += 45;
      result.interests.push('development');
      result.signals.push('Came from Stack Overflow (problem-solving developer)');
    }
    
    if (hostname.includes('dev.to') || hostname.includes('medium.com') || hostname.includes('hashnode.')) {
      result.source = 'content';
      result.medium = 'blog';
      result.techIndicator += 30;
      result.interests.push('reading', 'learning');
      result.signals.push('Came from tech blog platform');
    }
    
    // Newsletter/email
    if (params.has('ref') && params.get('ref')?.includes('email')) {
      result.medium = 'email';
      result.signals.push('Came from email newsletter');
    }
    
    // Product Hunt
    if (hostname.includes('producthunt.com')) {
      result.source = 'tech';
      result.medium = 'producthunt';
      result.techIndicator += 40;
      result.incomeIndicator += 10;
      result.interests.push('tech_products', 'startups', 'early_adopter');
      result.signals.push('Came from Product Hunt (early adopter)');
    }
    
  } catch {
    // Invalid URL, try basic analysis
    if (refLower.includes('google')) {
      result.source = 'search';
      result.medium = 'organic';
    } else if (refLower.includes('reddit')) {
      result.source = 'social';
      result.medium = 'reddit';
      result.techIndicator += 30;
    }
  }
  
  return result;
}

// ============================================
// ENHANCED PROFILING FUNCTIONS
// ============================================

export interface EnhancedProfile {
  // Demographics
  age: { range: string; confidence: number; signals: string[] };
  gender: { likely: string; confidence: number; signals: string[] };
  income: { level: string; estimate: string; confidence: number; signals: string[] };
  education: { level: string; confidence: number; signals: string[] };
  
  // Professional
  occupation: { primary: string; secondary: string[]; confidence: number; signals: string[] };
  industry: string[];
  workStyle: { type: string; confidence: number; signals: string[] };
  seniority: { level: string; confidence: number };
  
  // Personal
  relationshipStatus: { status: string; confidence: number; signals: string[] };
  hasChildren: { likely: boolean; ageGroup?: string; confidence: number; signals: string[] };
  livingArrangement: { type: string; confidence: number; signals: string[] };
  
  // Lifestyle
  techSavviness: { score: number; level: string; signals: string[] };
  privacyConsciousness: { score: number; level: string; signals: string[] };
  financialProfile: { type: string; signals: string[] };
  interests: string[];
  
  // Psychographic
  personality: { traits: string[]; workStyle: string; decisionMaking: string };
  currentMood: { state: string; confidence: number; signals: string[] };
  stressLevel: { level: string; confidence: number; signals: string[] };
  
  // Meta
  overallConfidence: number;
  dataQuality: number;
  topInsights: string[];
}

/**
 * Analyze browser languages for demographic signals
 */
function analyzeLanguages(languages: string[]): {
  primaryRegion: string;
  isMultilingual: boolean;
  educationSignal: string;
  techAdoption: number;
  professionSignals: string[];
} {
  const primary = languages[0] || 'en-US';
  const demo = LANGUAGE_DEMOGRAPHICS[primary] || LANGUAGE_DEMOGRAPHICS['en-US'];
  
  // Multiple languages suggest education/travel/international background
  const isMultilingual = languages.length > 1;
  const hasEnglishAsSecond = languages.length > 1 && 
    !languages[0].startsWith('en') && 
    languages.some(l => l.startsWith('en'));
  
  let educationSignal = demo.education_level;
  if (isMultilingual) {
    educationSignal = 'higher_than_average';
  }
  if (hasEnglishAsSecond) {
    educationSignal = 'likely_college_educated';
  }
  
  // Technical language combinations
  const hasCJK = languages.some(l => ['zh', 'ja', 'ko'].some(c => l.startsWith(c)));
  const hasEuropean = languages.some(l => ['de', 'fr', 'es', 'it', 'nl', 'sv'].some(c => l.startsWith(c)));
  
  const professionSignals: string[] = [...demo.professional_likelihood];
  if (hasCJK && languages.some(l => l.startsWith('en'))) {
    professionSignals.push('international_business');
  }
  if (hasEuropean && languages.length >= 3) {
    professionSignals.push('multinational_professional');
  }
  
  return {
    primaryRegion: demo.region,
    isMultilingual,
    educationSignal,
    techAdoption: demo.tech_adoption,
    professionSignals,
  };
}

/**
 * Analyze installed fonts for profession signals
 */
function analyzeFonts(fontsDetected: number, extensions: string[]): {
  professionScores: Record<string, number>;
  incomeModifier: number;
  signals: string[];
} {
  const professionScores: Record<string, number> = {};
  let incomeModifier = 0;
  const signals: string[] = [];
  
  // High font count suggests creative/design work
  if (fontsDetected > 30) {
    professionScores['designer'] = (professionScores['designer'] || 0) + 20;
    professionScores['creative'] = (professionScores['creative'] || 0) + 15;
    signals.push(`${fontsDetected} fonts installed (creative indicator)`);
    incomeModifier += 5;
  } else if (fontsDetected > 20) {
    professionScores['professional'] = (professionScores['professional'] || 0) + 10;
    signals.push(`${fontsDetected} fonts installed (above average)`);
  } else if (fontsDetected < 10) {
    signals.push(`${fontsDetected} fonts installed (minimal - stock system)`);
    incomeModifier -= 3;
  }
  
  // Extension analysis
  for (const ext of extensions) {
    const extData = EXTENSION_PROFILES[ext];
    if (extData) {
      for (const { profile, weight, income_mod } of extData) {
        professionScores[profile] = (professionScores[profile] || 0) + weight;
        if (income_mod) {
          incomeModifier += income_mod;
        }
      }
      signals.push(`${ext} extension detected`);
    }
  }
  
  return { professionScores, incomeModifier, signals };
}

/**
 * Deep time analysis for lifestyle and work patterns
 */
function analyzeTimePatterns(
  hour: number,
  dayOfWeek: number,
  behavioral: BehavioralData
): {
  workStyleMatch: string;
  lifestyleSignals: string[];
  parentLikelihood: number;
  stressIndicators: string[];
} {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isWeekday = !isWeekend;
  const lifestyleSignals: string[] = [];
  const stressIndicators: string[] = [];
  let parentLikelihood = 0;
  
  // Determine work style match
  let workStyleMatch = 'unknown';
  let bestMatchScore = 0;
  
  for (const [style, pattern] of Object.entries(TIME_PATTERNS)) {
    let score = 0;
    if (pattern.hours.includes(hour)) score += 30;
    if (pattern.weekend_work && isWeekend) score += 20;
    if (!pattern.weekend_work && isWeekday) score += 10;
    
    if (score > bestMatchScore) {
      bestMatchScore = score;
      workStyleMatch = style;
    }
  }
  
  // Specific time-based insights
  if (hour >= 22 || hour < 3) {
    lifestyleSignals.push('night_active');
    if (isWeekday) {
      lifestyleSignals.push('possible_irregular_schedule');
    }
  }
  
  if (hour >= 5 && hour < 7) {
    lifestyleSignals.push('early_riser');
    if (isWeekday) {
      parentLikelihood += 20; // Parents often up early with kids
      lifestyleSignals.push('morning_routine');
    }
  }
  
  // "After bedtime" window for parents (8pm-10:30pm weeknight)
  if (isWeekday && hour >= 20 && hour <= 22) {
    parentLikelihood += 25;
    lifestyleSignals.push('evening_quiet_time');
  }
  
  // Weekend early morning = kids don't let you sleep in
  if (isWeekend && hour >= 6 && hour < 9) {
    parentLikelihood += 30;
    lifestyleSignals.push('weekend_early_riser');
  }
  
  // Behavioral stress analysis
  if (behavioral.mouse.rageClicks > 0) {
    stressIndicators.push(`${behavioral.mouse.rageClicks} rage clicks`);
  }
  if (behavioral.mouse.erraticMovements > 10) {
    stressIndicators.push('erratic mouse movement');
  }
  if (behavioral.attention.tabSwitches > 15) {
    stressIndicators.push('high context switching');
  }
  
  // "Witching hour" stress (5-7pm) is a parent signal
  if (hour >= 17 && hour < 19 && stressIndicators.length > 0) {
    parentLikelihood += 15;
    lifestyleSignals.push('dinner_time_stress');
  }
  
  return {
    workStyleMatch,
    lifestyleSignals,
    parentLikelihood,
    stressIndicators,
  };
}

/**
 * Network intelligence analysis
 */
function analyzeNetwork(network: NetworkData): {
  ispType: string;
  incomeSignal: number;
  professionSignals: string[];
  locationSignals: string[];
  connectionQuality: string;
} {
  const ispLower = (network.isp || '').toLowerCase();
  const professionSignals: string[] = [];
  const locationSignals: string[] = [];
  
  // ISP analysis
  let ispType = 'residential';
  let incomeSignal = 50;
  
  for (const [keyword, data] of Object.entries(ISP_INTELLIGENCE)) {
    if (ispLower.includes(keyword)) {
      ispType = data.type;
      incomeSignal = data.income_tier * 20;
      if (data.likely_profession) {
        professionSignals.push(...data.likely_profession);
      }
      break;
    }
  }
  
  // City analysis
  if (network.city) {
    const cityData = CITY_INTELLIGENCE[network.city];
    if (cityData) {
      incomeSignal = Math.round(incomeSignal * cityData.avg_income_multiplier);
      locationSignals.push(`${network.city} (tech hub score: ${cityData.tech_hub_score}/10)`);
      professionSignals.push(...cityData.common_industries.slice(0, 2));
    }
  }
  
  // Connection quality analysis
  let connectionQuality = 'average';
  if (network.downlink && network.downlink > 50) {
    connectionQuality = 'excellent';
    incomeSignal += 5;
  } else if (network.downlink && network.downlink > 20) {
    connectionQuality = 'good';
  } else if (network.downlink && network.downlink < 5) {
    connectionQuality = 'poor';
    incomeSignal -= 10;
  }
  
  if (network.rtt && network.rtt < 20) {
    connectionQuality = 'fiber';
    incomeSignal += 10;
  }
  
  return {
    ispType,
    incomeSignal,
    professionSignals,
    locationSignals,
    connectionQuality,
  };
}

/**
 * Analyze screen/display for income and profession signals
 */
function analyzeDisplay(hardware: HardwareData): {
  deviceCategory: string;
  incomeIndicator: number;
  professionalIndicator: number;
  signals: string[];
} {
  const resolution = `${hardware.screenWidth}x${hardware.screenHeight}`;
  const signals: string[] = [];
  
  // Direct resolution match
  let screenData = SCREEN_INTELLIGENCE[resolution];
  
  // If no direct match, find closest
  if (!screenData) {
    const totalPixels = hardware.screenWidth * hardware.screenHeight;
    if (totalPixels > 8000000) {
      screenData = { device_type: 'High-res', likely_use: 'professional', income_indicator: 7, professional_indicator: 7 };
    } else if (totalPixels > 2000000) {
      screenData = { device_type: 'Standard', likely_use: 'general', income_indicator: 4, professional_indicator: 4 };
    } else {
      screenData = { device_type: 'Low-res', likely_use: 'budget', income_indicator: 2, professional_indicator: 2 };
    }
  }
  
  signals.push(`${resolution} (${screenData.device_type})`);
  
  // Pixel ratio enhancement
  let incomeBonus = 0;
  if (hardware.pixelRatio >= 2) {
    incomeBonus += 2;
    signals.push(`${hardware.pixelRatio}x pixel density (high-DPI display)`);
  }
  if (hardware.pixelRatio >= 3) {
    incomeBonus += 2;
    signals.push('Retina/high-end mobile display');
  }
  
  // Color depth
  if (hardware.colorDepth >= 30) {
    incomeBonus += 2;
    signals.push('10-bit color depth (professional display)');
  }
  
  return {
    deviceCategory: screenData.device_type,
    incomeIndicator: screenData.income_indicator + incomeBonus,
    professionalIndicator: screenData.professional_indicator,
    signals,
  };
}

/**
 * Analyze behavioral patterns for personality and current state
 */
function analyzeBehavior(behavioral: BehavioralData): {
  personalityTraits: string[];
  currentMood: string;
  moodConfidence: number;
  workStyle: string;
  engagementLevel: string;
  signals: string[];
} {
  const personalityTraits: string[] = [];
  const signals: string[] = [];
  let currentMood = 'neutral';
  let moodConfidence = 30;
  
  // Typing patterns -> personality
  if (behavioral.typing.averageWPM > 70) {
    personalityTraits.push('efficient');
    personalityTraits.push('experienced_typist');
    signals.push(`${behavioral.typing.averageWPM} WPM (fast typist)`);
  } else if (behavioral.typing.averageWPM > 0 && behavioral.typing.averageWPM < 30) {
    personalityTraits.push('deliberate');
    personalityTraits.push('careful');
    signals.push(`${behavioral.typing.averageWPM} WPM (deliberate typist)`);
  }
  
  // Mouse patterns -> decision making style
  if (behavioral.mouse.averageVelocity > 500) {
    personalityTraits.push('decisive');
    personalityTraits.push('action_oriented');
    signals.push('Fast mouse movement (decisive)');
  } else if (behavioral.mouse.averageVelocity > 0 && behavioral.mouse.averageVelocity < 200) {
    personalityTraits.push('methodical');
    personalityTraits.push('thorough');
    signals.push('Deliberate mouse movement');
  }
  
  // Frustration detection
  if (behavioral.mouse.rageClicks > 2) {
    currentMood = 'frustrated';
    moodConfidence = 80;
    personalityTraits.push('impatient');
    signals.push(`${behavioral.mouse.rageClicks} rage clicks detected`);
  } else if (behavioral.mouse.rageClicks > 0) {
    currentMood = 'slightly_frustrated';
    moodConfidence = 60;
    signals.push('Some frustration detected');
  }
  
  // Erratic behavior -> anxiety/searching
  if (behavioral.mouse.erraticMovements > 15) {
    if (currentMood === 'neutral') {
      currentMood = 'anxious_searching';
      moodConfidence = 70;
    }
    personalityTraits.push('high_energy');
    signals.push(`${behavioral.mouse.erraticMovements} erratic movements`);
  }
  
  // Focus level
  let workStyle = 'balanced';
  if (behavioral.attention.tabSwitches > 15) {
    workStyle = 'multitasker';
    personalityTraits.push('scattered_attention');
    signals.push(`${behavioral.attention.tabSwitches} tab switches (heavy multitasking)`);
  } else if (behavioral.attention.tabSwitches < 3 && behavioral.attention.focusTime > 60000) {
    workStyle = 'deep_focus';
    personalityTraits.push('focused');
    if (currentMood === 'neutral') {
      currentMood = 'focused';
      moodConfidence = 65;
    }
    signals.push('Deep focus detected');
  }
  
  // Engagement level
  let engagementLevel = 'medium';
  const engagement = behavioral.emotions.engagement;
  if (engagement > 70) {
    engagementLevel = 'high';
  } else if (engagement < 30) {
    engagementLevel = 'low';
    if (currentMood === 'neutral') {
      currentMood = 'disengaged';
      moodConfidence = 50;
    }
  }
  
  return {
    personalityTraits,
    currentMood,
    moodConfidence,
    workStyle,
    engagementLevel,
    signals,
  };
}

/**
 * Analyze social logins and wallets for demographic signals
 */
function analyzeSocialPresence(
  socialLogins: SocialLogins,
  cryptoWallets: CryptoWallets
): {
  ageSignal: number; // Modifier -20 to +20
  techSignal: number;
  incomeSignal: number;
  interests: string[];
  signals: string[];
} {
  const interests: string[] = [];
  const signals: string[] = [];
  let ageSignal = 0;
  let techSignal = 0;
  let incomeSignal = 0;
  
  // Facebook analysis
  if (socialLogins.facebook) {
    ageSignal += 5; // Facebook skews slightly older
    signals.push('Facebook login detected');
    
    if (!socialLogins.twitter && !socialLogins.reddit) {
      ageSignal += 10; // Facebook-only users tend to be 35+
      signals.push('Facebook-only social presence (older demographic)');
    }
  }
  
  // GitHub = developer
  if (socialLogins.github) {
    techSignal += 40;
    interests.push('software_development');
    incomeSignal += 15;
    signals.push('GitHub login detected (developer)');
    ageSignal -= 5; // Developers skew younger
  }
  
  // Reddit = younger, tech-savvy
  if (socialLogins.reddit) {
    ageSignal -= 10;
    techSignal += 20;
    interests.push('internet_culture');
    signals.push('Reddit login detected');
  }
  
  // Twitter/X
  if (socialLogins.twitter) {
    techSignal += 10;
    interests.push('news_current_events');
    signals.push('Twitter/X login detected');
  }
  
  // Crypto wallets = tech-savvy + higher income potential
  if (cryptoWallets.hasAnyWallet) {
    techSignal += 25;
    interests.push('cryptocurrency');
    incomeSignal += 10;
    ageSignal -= 8; // Crypto users tend younger
    
    const walletCount = [
      cryptoWallets.metamask,
      cryptoWallets.phantom,
      cryptoWallets.coinbase,
      cryptoWallets.braveWallet,
      cryptoWallets.trustWallet,
    ].filter(Boolean).length;
    
    if (walletCount >= 2) {
      techSignal += 15;
      incomeSignal += 10;
      interests.push('defi');
      signals.push(`${walletCount} crypto wallets (active trader/investor)`);
    }
    
    if (cryptoWallets.phantom || cryptoWallets.solflare) {
      interests.push('solana_ecosystem');
      ageSignal -= 3; // Solana users tend even younger
      signals.push('Solana ecosystem wallet');
    }
    
    if (cryptoWallets.metamask) {
      interests.push('ethereum_ecosystem');
      signals.push('Ethereum wallet (MetaMask)');
    }
  }
  
  return { ageSignal, techSignal, incomeSignal, interests, signals };
}

/**
 * Analyze privacy stance
 */
function analyzePrivacyStance(
  tracking: TrackingDetection,
  browser: BrowserData,
  botDetection: BotDetectionData
): {
  privacyScore: number;
  privacyLevel: string;
  techSavviness: number;
  signals: string[];
} {
  let privacyScore = 0;
  let techSavviness = 0;
  const signals: string[] = [];
  
  if (tracking.adBlocker) {
    privacyScore += 30;
    techSavviness += 15;
    signals.push('Ad blocker active');
  }
  
  if (tracking.doNotTrack) {
    privacyScore += 15;
    techSavviness += 5;
    signals.push('Do Not Track enabled');
  }
  
  if (tracking.globalPrivacyControl) {
    privacyScore += 20;
    techSavviness += 10;
    signals.push('Global Privacy Control enabled');
  }
  
  if (botDetection.incognitoMode) {
    privacyScore += 25;
    techSavviness += 10;
    signals.push('Incognito/private mode detected');
  }
  
  // Session history length (tab navigation depth only)
  if (browser.historyLength === 1) {
    signals.push('Fresh tab session');
  } else if (browser.historyLength > 50) {
    signals.push('Deep tab session');
  }
  
  // DevTools = tech savvy
  if (botDetection.devToolsOpen) {
    techSavviness += 40;
    signals.push('Developer tools open');
  }
  
  let privacyLevel = 'low';
  if (privacyScore >= 60) privacyLevel = 'high';
  else if (privacyScore >= 30) privacyLevel = 'medium';
  
  return { privacyScore, privacyLevel, techSavviness, signals };
}

/**
 * Master profiling function - combines all signals
 */
export function generateEnhancedProfile(
  hardware: HardwareData,
  network: NetworkData,
  browser: BrowserData,
  behavioral: BehavioralData,
  fingerprints: FingerprintData,
  botDetection: BotDetectionData,
  cryptoWallets: CryptoWallets,
  socialLogins: SocialLogins,
  tracking: TrackingDetection,
  _systemPreferences: SystemPreferences
): EnhancedProfile {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  
  // Run all analysis functions
  const languageAnalysis = analyzeLanguages(browser.languages);
  const fontAnalysis = analyzeFonts(fingerprints.fontsDetected, fingerprints.extensionsDetected);
  const timeAnalysis = analyzeTimePatterns(hour, dayOfWeek, behavioral);
  const networkAnalysis = analyzeNetwork(network);
  const displayAnalysis = analyzeDisplay(hardware);
  const behaviorAnalysis = analyzeBehavior(behavioral);
  const socialAnalysis = analyzeSocialPresence(socialLogins, cryptoWallets);
  const privacyAnalysis = analyzePrivacyStance(tracking, browser, botDetection);
  const referrerAnalysis = analyzeReferrer(browser.referrer);
  
  // Collect all signals
  const allSignals: string[] = [
    ...fontAnalysis.signals,
    ...timeAnalysis.lifestyleSignals,
    ...networkAnalysis.locationSignals,
    ...displayAnalysis.signals,
    ...behaviorAnalysis.signals,
    ...socialAnalysis.signals,
    ...privacyAnalysis.signals,
    ...referrerAnalysis.signals,
  ];
  
  // ============================================
  // AGE CALCULATION
  // ============================================
  let ageScore = 32; // Start at median adult age
  let ageConfidence = 30;
  const ageSignals: string[] = [];
  
  // Social signals
  ageScore += socialAnalysis.ageSignal * 0.3;
  
  // Referrer signals (strong age indicator)
  ageScore += referrerAnalysis.ageIndicator * 0.5;
  if (referrerAnalysis.socialPlatform === 'tiktok') {
    ageSignals.push('TikTok referrer (younger demographic)');
    ageConfidence += 10;
  } else if (referrerAnalysis.socialPlatform === 'facebook') {
    ageSignals.push('Facebook referrer (older demographic)');
    ageConfidence += 8;
  } else if (referrerAnalysis.socialPlatform === 'reddit') {
    ageSignals.push('Reddit user (tech-savvy demographic)');
    ageConfidence += 5;
  } else if (referrerAnalysis.socialPlatform === 'hackernews') {
    ageSignals.push('Hacker News (tech professional)');
    ageConfidence += 10;
  }
  
  // Tech savviness correlation (higher tech = younger tendency)
  const techScore = languageAnalysis.techAdoption + socialAnalysis.techSignal + privacyAnalysis.techSavviness + referrerAnalysis.techIndicator;
  if (techScore > 150) {
    ageScore -= 5;
    ageSignals.push('High tech sophistication');
  } else if (techScore < 50) {
    ageScore += 5;
  }
  
  // Time patterns
  if (timeAnalysis.workStyleMatch === 'night_owl') {
    ageScore -= 3;
    ageSignals.push('Night owl pattern');
  } else if (timeAnalysis.workStyleMatch === 'early_bird') {
    ageScore += 3;
    ageSignals.push('Early bird pattern');
  }
  
  // Device signals
  if (hardware.gpu?.toLowerCase().includes('m1') || hardware.gpu?.toLowerCase().includes('m2') || hardware.gpu?.toLowerCase().includes('m3')) {
    ageScore += 2; // Mac users skew slightly older (professionals)
    ageConfidence += 5;
    ageSignals.push('Apple Silicon (professional)');
  }
  
  // Clamp and convert to range
  ageScore = Math.max(16, Math.min(65, ageScore));
  const ageRange = ageScore < 22 ? '16-22' :
                   ageScore < 28 ? '22-28' :
                   ageScore < 35 ? '28-35' :
                   ageScore < 45 ? '35-45' :
                   ageScore < 55 ? '45-55' : '55+';
  
  // ============================================
  // INCOME CALCULATION
  // ============================================
  let incomeScore = 50;
  const incomeSignals: string[] = [];
  
  // Hardware signals
  incomeScore += (displayAnalysis.incomeIndicator - 5) * 5;
  incomeSignals.push(...displayAnalysis.signals.slice(0, 2));
  
  // Network signals
  incomeScore += (networkAnalysis.incomeSignal - 50) * 0.5;
  
  // Font/extension signals
  incomeScore += fontAnalysis.incomeModifier;
  
  // Social/crypto signals
  incomeScore += socialAnalysis.incomeSignal;
  
  // Referrer signals (where they come from indicates economic status)
  incomeScore += referrerAnalysis.incomeIndicator;
  if (referrerAnalysis.socialPlatform === 'hackernews' || referrerAnalysis.socialPlatform === 'linkedin') {
    incomeSignals.push(`Came from ${referrerAnalysis.socialPlatform} (professional network)`);
  }
  
  // GPU-based income
  const gpu = (hardware.gpu || '').toLowerCase();
  if (gpu.includes('rtx 4090') || gpu.includes('rtx 4080')) {
    incomeScore += 25;
    incomeSignals.push('Premium GPU ($1000+)');
  } else if (gpu.includes('rtx 40') || gpu.includes('rtx 30')) {
    incomeScore += 15;
    incomeSignals.push('High-end GPU');
  } else if (gpu.includes('intel') || gpu.includes('uhd')) {
    incomeScore -= 10;
  }
  
  // RAM-based income
  if (hardware.ram && hardware.ram >= 32) {
    incomeScore += 15;
    incomeSignals.push(`${hardware.ram}GB RAM (workstation)`);
  } else if (hardware.ram && hardware.ram >= 16) {
    incomeScore += 5;
  } else if (hardware.ram && hardware.ram <= 8) {
    incomeScore -= 10;
  }
  
  // Location cost-of-living adjustment
  if (network.city) {
    const cityData = CITY_INTELLIGENCE[network.city];
    if (cityData && cityData.cost_of_living >= 8) {
      incomeScore += 15;
      incomeSignals.push(`High cost of living area (${network.city})`);
    }
  }
  
  incomeScore = Math.max(0, Math.min(100, incomeScore));
  
  const incomeLevel = incomeScore >= 80 ? 'high' :
                      incomeScore >= 60 ? 'upper-middle' :
                      incomeScore >= 40 ? 'middle' :
                      incomeScore >= 20 ? 'lower-middle' : 'low';
  
  const incomeEstimate = incomeScore >= 85 ? '$200k+/year' :
                         incomeScore >= 70 ? '$120k-$200k/year' :
                         incomeScore >= 55 ? '$80k-$120k/year' :
                         incomeScore >= 40 ? '$50k-$80k/year' :
                         incomeScore >= 25 ? '$30k-$50k/year' : '<$30k/year';
  
  // ============================================
  // OCCUPATION DETERMINATION
  // ============================================
  const professionScores: Record<string, number> = { ...fontAnalysis.professionScores };
  const occupationSignals: string[] = [];
  
  // Network profession signals
  for (const prof of networkAnalysis.professionSignals) {
    professionScores[prof] = (professionScores[prof] || 0) + 15;
  }
  
  // Language profession signals
  for (const prof of languageAnalysis.professionSignals) {
    professionScores[prof] = (professionScores[prof] || 0) + 10;
  }
  
  // DevTools = developer
  if (botDetection.devToolsOpen) {
    professionScores['developer'] = (professionScores['developer'] || 0) + 50;
    occupationSignals.push('DevTools open');
  }
  
  // GitHub = developer
  if (socialLogins.github) {
    professionScores['developer'] = (professionScores['developer'] || 0) + 40;
    professionScores['frontend_dev'] = (professionScores['frontend_dev'] || 0) + 20;
    occupationSignals.push('GitHub login');
  }
  
  // High-end display + Apple = creative
  if (displayAnalysis.professionalIndicator >= 8 && 
      (gpu.includes('m1') || gpu.includes('m2') || gpu.includes('m3'))) {
    professionScores['creative'] = (professionScores['creative'] || 0) + 30;
    professionScores['designer'] = (professionScores['designer'] || 0) + 25;
    occupationSignals.push('Creative workstation');
  }
  
  // Gaming GPU + night time = gamer/streamer
  if ((gpu.includes('rtx') || gpu.includes('radeon')) && 
      (hour >= 22 || hour < 4) && 
      !botDetection.devToolsOpen) {
    professionScores['gamer'] = (professionScores['gamer'] || 0) + 30;
    occupationSignals.push('Gaming hardware + late hours');
  }
  
  // Sort and get top professions
  const sortedProfessions = Object.entries(professionScores)
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score >= 20);
  
  const primaryOccupation = sortedProfessions[0]?.[0] || 'professional';
  const secondaryOccupations = sortedProfessions.slice(1, 3).map(([p]) => p);
  
  // ============================================
  // PARENT/FAMILY DETECTION
  // ============================================
  let parentConfidence = timeAnalysis.parentLikelihood;
  const parentSignals: string[] = [];
  
  // Age factor
  if (ageScore >= 28 && ageScore <= 50) {
    parentConfidence += 15;
    parentSignals.push('Prime parenting age range');
  }
  
  // Income factor
  if (incomeScore >= 50) {
    parentConfidence += 10;
    parentSignals.push('Stable income');
  }
  
  // Facebook = parents use it
  if (socialLogins.facebook) {
    parentConfidence += 15;
    parentSignals.push('Facebook active (parent networks)');
  }
  
  // Tablet/family device
  if (hardware.touchSupport && hardware.screenWidth >= 768 && hardware.screenWidth <= 1366) {
    parentConfidence += 10;
    parentSignals.push('Tablet device (family use)');
  }
  
  parentConfidence = Math.min(95, parentConfidence);
  
  const hasChildren: { 
    likely: boolean; 
    confidence: number; 
    signals: string[]; 
    ageGroup?: string;
  } = {
    likely: parentConfidence >= 40,
    confidence: parentConfidence,
    signals: parentSignals,
  };
  
  if (parentConfidence >= 60) {
    hasChildren.ageGroup = ageScore < 35 ? 'young_children' : ageScore < 45 ? 'school_age' : 'teenagers';
  }
  
  // ============================================
  // BUILD FINAL PROFILE
  // ============================================
  
  // Collect all interests
  const allInterests = [
    ...socialAnalysis.interests,
    ...referrerAnalysis.interests,
    ...(professionScores['developer'] >= 30 ? ['programming', 'technology'] : []),
    ...(professionScores['designer'] >= 30 ? ['design', 'creativity'] : []),
    ...(professionScores['gamer'] >= 30 ? ['gaming', 'esports'] : []),
    ...(tracking.adBlocker ? ['privacy'] : []),
  ];
  
  // Calculate overall confidence
  const dataPointCount = allSignals.length;
  const overallConfidence = Math.min(95, 30 + dataPointCount * 2);
  
  // Generate top insights
  const topInsights: string[] = [];
  
  // Referrer-based insights (most immediately relevant)
  if (referrerAnalysis.searchQuery) {
    topInsights.push(`You searched for "${referrerAnalysis.searchQuery}" - we can see exactly how you found this page`);
  } else if (referrerAnalysis.socialPlatform === 'hackernews') {
    topInsights.push('You came from Hacker News - that immediately tells us you\'re a tech professional or enthusiast');
  } else if (referrerAnalysis.socialPlatform === 'reddit') {
    topInsights.push(`You clicked through from Reddit${referrerAnalysis.signals.find(s => s.includes('r/')) ? ' (' + referrerAnalysis.signals.find(s => s.includes('r/')) + ')' : ''} - we know your interests now`);
  } else if (referrerAnalysis.socialPlatform === 'linkedin') {
    topInsights.push('You came from LinkedIn - career-focused and professional networking mode');
  }
  
  if (botDetection.devToolsOpen) {
    topInsights.push('Developer tools are open - you\'re examining this page\'s code');
  }
  if (socialLogins.github && socialLogins.google) {
    topInsights.push('Your GitHub and Google accounts reveal a tech professional profile');
  }
  if (network.city && CITY_INTELLIGENCE[network.city]) {
    const cityData = CITY_INTELLIGENCE[network.city];
    topInsights.push(`You're in ${network.city}, a ${cityData.tech_hub_score >= 8 ? 'major tech hub' : 'growing tech city'} with ${cityData.avg_income_multiplier > 1.3 ? 'high' : 'moderate'} cost of living`);
  }
  if (cryptoWallets.hasAnyWallet) {
    topInsights.push('Your crypto wallet presence indicates you\'re part of the web3/DeFi ecosystem');
  }
  if (hasChildren.likely) {
    topInsights.push(`Your browsing patterns (${hour >= 20 && hour <= 22 ? 'post-bedtime evening' : timeAnalysis.lifestyleSignals[0] || 'timing'}) suggest you likely have children`);
  }
  if (tracking.adBlocker) {
    topInsights.push('You use an ad blocker, putting you in the ~40% of tech-savvy users who value privacy');
  }
  
  // Add a general summary insight
  if (topInsights.length < 5 && incomeScore >= 60) {
    topInsights.push(`Your ${displayAnalysis.deviceCategory} display and ${networkAnalysis.connectionQuality} connection suggest an above-average income bracket`);
  }
  
  return {
    age: {
      range: ageRange,
      confidence: Math.min(75, ageConfidence + dataPointCount),
      signals: ageSignals,
    },
    gender: {
      likely: 'unknown', // We don't have reliable signals for this
      confidence: 20,
      signals: ['Insufficient data for gender prediction'],
    },
    income: {
      level: incomeLevel,
      estimate: incomeEstimate,
      confidence: Math.min(70, 35 + incomeSignals.length * 5),
      signals: incomeSignals,
    },
    education: {
      level: languageAnalysis.educationSignal === 'very_high' ? 'Graduate degree likely' :
             languageAnalysis.educationSignal === 'high' ? 'Bachelor\'s degree likely' :
             languageAnalysis.educationSignal === 'higher_than_average' ? 'College educated' :
             languageAnalysis.educationSignal === 'likely_college_educated' ? 'College educated (multilingual)' :
             'Unknown',
      confidence: 40,
      signals: languageAnalysis.isMultilingual ? ['Multilingual (higher education indicator)'] : [],
    },
    occupation: {
      primary: primaryOccupation.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      secondary: secondaryOccupations.map(o => o.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())),
      confidence: sortedProfessions[0] ? Math.min(85, sortedProfessions[0][1]) : 30,
      signals: occupationSignals,
    },
    industry: languageAnalysis.professionSignals.slice(0, 3),
    workStyle: {
      type: timeAnalysis.workStyleMatch.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      confidence: 55,
      signals: timeAnalysis.lifestyleSignals.slice(0, 2),
    },
    seniority: {
      level: incomeScore >= 70 && ageScore >= 30 ? 'Senior/Lead' :
             incomeScore >= 50 && ageScore >= 25 ? 'Mid-level' :
             ageScore < 25 ? 'Entry-level/Junior' : 'Mid-level',
      confidence: 45,
    },
    relationshipStatus: {
      status: hasChildren.likely ? 'Likely partnered' : 
              ageScore < 25 ? 'Unknown (young demographic)' : 'Unknown',
      confidence: hasChildren.likely ? 55 : 20,
      signals: hasChildren.likely ? ['Parenting indicators suggest partnership'] : [],
    },
    hasChildren,
    livingArrangement: {
      type: hasChildren.likely ? 'Family household' :
            ageScore < 25 && incomeScore < 40 ? 'Shared/rental' :
            incomeScore >= 70 && ageScore >= 32 ? 'Homeowner likely' :
            'Unknown',
      confidence: 40,
      signals: [],
    },
    techSavviness: {
      score: Math.min(100, languageAnalysis.techAdoption + socialAnalysis.techSignal + privacyAnalysis.techSavviness),
      level: privacyAnalysis.techSavviness >= 70 ? 'Expert' :
             privacyAnalysis.techSavviness >= 40 ? 'Advanced' :
             privacyAnalysis.techSavviness >= 20 ? 'Intermediate' : 'Basic',
      signals: privacyAnalysis.signals,
    },
    privacyConsciousness: {
      score: privacyAnalysis.privacyScore,
      level: privacyAnalysis.privacyLevel.replace(/\b\w/g, l => l.toUpperCase()),
      signals: privacyAnalysis.signals,
    },
    financialProfile: {
      type: incomeScore >= 70 ? 'Premium buyer' :
            incomeScore >= 50 ? 'Quality-focused' :
            incomeScore >= 30 ? 'Value-conscious' : 'Budget-focused',
      signals: incomeSignals.slice(0, 3),
    },
    interests: [...new Set(allInterests)].slice(0, 8),
    personality: {
      traits: behaviorAnalysis.personalityTraits,
      workStyle: behaviorAnalysis.workStyle,
      decisionMaking: behaviorAnalysis.personalityTraits.includes('decisive') ? 'Quick and confident' :
                      behaviorAnalysis.personalityTraits.includes('methodical') ? 'Careful and thorough' :
                      'Balanced',
    },
    currentMood: {
      state: behaviorAnalysis.currentMood.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      confidence: behaviorAnalysis.moodConfidence,
      signals: timeAnalysis.stressIndicators,
    },
    stressLevel: {
      level: timeAnalysis.stressIndicators.length >= 3 ? 'High' :
             timeAnalysis.stressIndicators.length >= 1 ? 'Medium' : 'Low',
      confidence: 40 + timeAnalysis.stressIndicators.length * 15,
      signals: timeAnalysis.stressIndicators,
    },
    overallConfidence,
    dataQuality: dataPointCount >= 20 ? 90 : dataPointCount >= 10 ? 70 : 50,
    topInsights: topInsights.slice(0, 5),
  };
}
