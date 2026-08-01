import { motion } from 'framer-motion';
import { Brain, AlertTriangle, User, DollarSign, Briefcase, Heart, Lightbulb } from 'lucide-react';
import { useProfileStore } from '../../store/useProfileStore';
import { DataSection, DataRow, ScoreRing, InsightCard } from '../ui/DataSection';

export function AIAnalysisHero() {
  const { aiAnalysis, network, aiConfidence } = useProfileStore();

  return (
    <div className="mb-6">
      <motion.div
        className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <Brain size={14} className="text-cyan-400/70" />
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-white/60">
              Heuristic Analysis
            </h2>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-violet-500/20 text-violet-400/80 border border-violet-500/20">
              DATA-DRIVEN
            </span>
          </div>
          <span className="text-[10px] font-mono text-cyan-400/60">
            {aiConfidence > 0 ? `${aiConfidence}% conf` : 'analyzing...'}
          </span>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-4 gap-3 mb-4">
            <ScoreRing
              value={aiAnalysis.humanScore}
              label="Human"
              color={aiAnalysis.humanScore >= 70 ? 'green' : aiAnalysis.humanScore >= 40 ? 'yellow' : 'red'}
            />
            <ScoreRing
              value={aiAnalysis.fraudRisk}
              label="Fraud"
              color={aiAnalysis.fraudRisk >= 70 ? 'red' : aiAnalysis.fraudRisk >= 40 ? 'yellow' : 'green'}
            />
            <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/[0.02]">
              <span className="text-violet-400/80 font-mono text-xs font-medium capitalize">{aiAnalysis.deviceTier}</span>
              <span className="text-white/30 text-[9px] uppercase tracking-wider mt-1">Tier</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/[0.02]">
              <span className="text-cyan-400/80 font-mono text-[10px] font-medium">{aiAnalysis.deviceValue}</span>
              <span className="text-white/30 text-[9px] uppercase tracking-wider mt-1">Value</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Age', value: aiAnalysis.ageRange },
              { label: 'Location', value: network.country || 'Unknown' },
              { label: 'Income', value: aiAnalysis.incomeLevel },
              { label: 'Work', value: aiAnalysis.occupation },
            ].map((item, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-white/[0.02]">
                <span className="text-white/30 text-[9px] uppercase tracking-wider block mb-1">{item.label}</span>
                <span className="text-white/70 text-[11px] capitalize truncate block">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function PersonalLifeSection() {
  const { personalLife } = useProfileStore();

  // Check if these are actually determinable vs just guesses
  const isActuallyUnknown = (value: string) => 
    value.toLowerCase().includes('unknown') || 
    value.toLowerCase().includes('cannot determine') ||
    value.toLowerCase().includes('insufficient');

  return (
    <DataSection title="Personal Life" icon={<User size={14} />}>
      <DataRow 
        label="Parent Status" 
        value={personalLife.parent} 
        dimmed={isActuallyUnknown(personalLife.parent)}
      />
      <DataRow 
        label="Living Situation" 
        value={personalLife.homeowner} 
        dimmed={isActuallyUnknown(personalLife.homeowner)}
      />
      <DataRow 
        label="Relationship" 
        value={personalLife.socialType} 
        dimmed={isActuallyUnknown(personalLife.socialType)}
      />
      {/* Only show pet/car if we somehow have data (we don't) */}
      {!isActuallyUnknown(personalLife.petOwner) && personalLife.petOwner !== 'Unknown' && (
        <DataRow label="Pet Owner" value={personalLife.petOwner} />
      )}
      {!isActuallyUnknown(personalLife.carOwner) && personalLife.carOwner !== 'Unknown' && (
        <DataRow label="Car Owner" value={personalLife.carOwner} />
      )}
      <div className="py-2 text-white/30 text-[10px] italic border-t border-white/5 mt-2">
        Based on schedule patterns, income signals, and age estimates. Pet/car ownership cannot be determined.
      </div>
    </DataSection>
  );
}

export function MentalPhysicalSection() {
  const { mentalPhysical, behavioral } = useProfileStore();
  
  // Derive stress from behavioral signals
  const stressIndicators = [];
  if (behavioral.mouse.rageClicks > 0) stressIndicators.push('rage clicks');
  if (behavioral.mouse.erraticMovements > 10) stressIndicators.push('erratic movement');
  if (behavioral.attention.tabSwitches > 15) stressIndicators.push('high context switching');
  
  const stressDetail = stressIndicators.length > 0 
    ? `${mentalPhysical.stressLevel} (${stressIndicators.join(', ')})` 
    : mentalPhysical.stressLevel;
  
  // Derive focus level
  const focusLevel = behavioral.attention.tabSwitches < 3 ? 'High focus' :
                     behavioral.attention.tabSwitches < 8 ? 'Moderate focus' :
                     'Scattered attention';

  return (
    <DataSection title="Current State" icon={<Heart size={14} />}>
      <DataRow label="Stress Level" value={stressDetail} />
      <DataRow label="Focus Level" value={focusLevel} />
      <DataRow label="Sleep Pattern" value={mentalPhysical.sleepSchedule} />
      <DataRow label="Current Mood" value={mentalPhysical.healthConscious} />
      <div className="py-2 text-white/30 text-[10px] italic border-t border-white/5 mt-2">
        Note: Fitness level and health habits cannot be determined from browser data.
      </div>
    </DataSection>
  );
}

export function LifestyleSection() {
  const { lifestyle, fingerprints, behavioral, systemPreferences } = useProfileStore();

  // Derive screen time from behavioral data
  const focusTime = behavioral.attention.focusTime || 0;
  const screenTimeLevel = focusTime > 300000 ? 'Heavy (5+ min active)' : 
                          focusTime > 60000 ? 'Moderate' : 
                          'Light (new session)';
  
  // Derive work style from extensions and patterns
  const hasProductivityTools = fingerprints.extensionsDetected?.some(e => 
    ['Notion Web Clipper', 'Evernote Web Clipper', 'Todoist', 'Pocket'].includes(e)
  );
  const workPatternText = hasProductivityTools ? 'Productivity-focused' : 
                          behavioral.attention.tabSwitches > 10 ? 'Heavy multitasker' :
                          'Focused worker';

  return (
    <DataSection title="Lifestyle & Habits" icon={<Briefcase size={14} />}>
      <DataRow label="Schedule" value={lifestyle.travel || 'Unknown'} />
      <DataRow label="Work Pattern" value={workPatternText} />
      <DataRow label="Screen Time" value={screenTimeLevel} />
      <DataRow label="Visual Preference" value={systemPreferences.colorScheme === 'dark' ? 'Dark mode user' : 'Light mode user'} />
      <div className="py-2 text-white/30 text-[10px] italic border-t border-white/5 mt-2">
        Note: Caffeine, alcohol, and smoking habits cannot be determined from browser data.
      </div>
    </DataSection>
  );
}

export function FinancialSection() {
  const { financial, fingerprints, cryptoWallets } = useProfileStore();
  
  // Derive shopping behavior from extensions
  const hasShoppingExtensions = fingerprints.extensionsDetected?.some(e => 
    ['Honey', 'Rakuten (Ebates)', 'Capital One Shopping', 'RetailMeNot', 'Keepa', 'CamelCamelCamel'].includes(e)
  );
  
  const shoppingStyle = hasShoppingExtensions 
    ? 'Deal hunter (shopping extensions detected)' 
    : financial.shoppingStyle;
  
  // Build brand/ecosystem affinity from actual signals
  const ecosystems: string[] = [...(financial.brandAffinity || [])];
  
  // Add crypto ecosystems
  if (cryptoWallets.metamask && !ecosystems.includes('Ethereum')) ecosystems.push('Ethereum');
  if (cryptoWallets.phantom && !ecosystems.includes('Solana')) ecosystems.push('Solana');
  if (cryptoWallets.coinbase && !ecosystems.includes('Coinbase')) ecosystems.push('Coinbase');
  
  // Add extension-based ecosystems
  if (fingerprints.extensionsDetected?.includes('Save to Google Drive')) ecosystems.push('Google Workspace');
  if (fingerprints.extensionsDetected?.includes('Notion Web Clipper')) ecosystems.push('Notion');

  return (
    <DataSection title="Financial & Shopping" icon={<DollarSign size={14} />}>
      <DataRow label="Shopping Style" value={shoppingStyle} />
      <div className="py-2.5 border-b border-white/[0.03]">
        <span className="text-white/40 text-[12px] block mb-2">Tech Ecosystem</span>
        <div className="flex flex-wrap gap-2">
          {ecosystems.length > 0 ? (
            ecosystems.map((brand, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20"
              >
                {brand}
              </span>
            ))
          ) : (
            <span className="text-white/30 text-[12px]">No strong ecosystem signals</span>
          )}
        </div>
      </div>
    </DataSection>
  );
}

export function CreepyInsightsSection() {
  const { creepyInsights } = useProfileStore();

  return (
    <div className="mb-6">
      <motion.div
        className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/5">
          <AlertTriangle size={14} className="text-rose-400/70" />
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-white/60">Creepy Insights</h3>
        </div>
        <div className="p-4 space-y-2">
          {creepyInsights.insights.map((insight, i) => (
            <InsightCard key={i} insight={insight} index={i} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export function UserProfileSection() {
  const { userProfile } = useProfileStore();

  return (
    <DataSection title="Who They Think You Are" icon={<User size={14} />}>
      {Object.entries(userProfile).map(([key, data]) => (
        <div key={key} className="flex justify-between items-center py-2.5 border-b border-white/[0.03] last:border-0 gap-3">
          <span className="text-white/40 text-[12px] capitalize">
            {key.replace(/([A-Z])/g, ' $1').trim()}
          </span>
          <div className="flex items-center gap-2">
            <span className={`font-mono text-[12px] ${data.detected ? 'text-emerald-400/80' : 'text-white/30'}`}>
              {data.detected ? 'Yes' : 'No'}
            </span>
            <span className="text-white/20 text-[10px] font-mono">({data.confidence}%)</span>
          </div>
        </div>
      ))}
    </DataSection>
  );
}

export function PersonalityTraitsSection() {
  const { personalityTraits } = useProfileStore();

  const traits = [
    { label: 'Cautious', value: personalityTraits.cautious },
    { label: 'Privacy-focused', value: personalityTraits.privacyFocused },
    { label: 'Early Adopter', value: personalityTraits.earlyAdopter },
  ];

  return (
    <DataSection title="Personality" icon={<Lightbulb size={14} />}>
      {traits.map((trait, i) => (
        <div key={i} className="flex justify-between items-center py-2.5 border-b border-white/[0.03] last:border-0 gap-3">
          <span className="text-white/40 text-[12px]">{trait.label}</span>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${trait.value ? 'bg-emerald-400' : 'bg-white/20'}`} />
            <span className={`font-mono text-[12px] ${trait.value ? 'text-emerald-400/80' : 'text-white/30'}`}>
              {trait.value ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      ))}
    </DataSection>
  );
}

export function InferredInterestsSection() {
  const { inferredInterests } = useProfileStore();

  return (
    <DataSection title="Interests" icon={<Lightbulb size={14} />}>
      <DataRow label="Cryptocurrency" value={inferredInterests.cryptocurrency} />
      <DataRow label="Privacy" value={inferredInterests.privacy} />
      <DataRow label="Web Tech" value={inferredInterests.modernWebTechnologies} />
      <DataRow label="Gaming" value={inferredInterests.gaming} />
      <DataRow label="Design" value={inferredInterests.design} />
      <DataRow label="Development" value={inferredInterests.development} />
    </DataSection>
  );
}
