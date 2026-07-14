// YouTube Strategy Studio Types

export interface StrategyPrompt {
  id: number;
  title: string;
  shortTitle: string;
  description: string;
  fields: StrategyField[];
  buildPrompt: (vals: Record<string, string>) => string;
}

export interface StrategyField {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "textarea";
}

export interface ChannelStrategy {
  id: string;
  userId: string;
  channelName: string;
  channelTagline: string;
  niche: string;
  targetAudience: string;
  postingFrequency: string;
  interests: string;
  goals: string;
  timeAvailable: string;
  monetizationPotential: number;
  competitionLevel: string;
  nicheCompleted: boolean;
  roadmapCompleted: boolean;
  monetizationCompleted: boolean;
  automationCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContentRoadmapWeek {
  weekNumber: number;
  videoTitle: string;
  videoType: "EDU" | "ENT" | "VIR";
  seoNotes: string;
  shortsDescription: string;
}

export interface ContentPillar {
  pillarName: string;
  pillarDescription: string;
  percentage: number;
}

export interface MonetizationStream {
  revenueStream: "adsense" | "sponsorship" | "digital_product" | "affiliate" | "membership";
  estimatedRevenue: number;
  monthlyBudget: number;
  notes: string;
}

export interface AutomationSOP {
  workflowName: string;
  dailyHoursRequired: number;
  toolsUsed: string[];
  batchSize: number;
  monthlyCost: number;
  workflowSteps: Array<{
    step: number;
    task: string;
    time: number; // minutes
    tool: string;
    notes: string;
  }>;
}

export interface StrategyOutput {
  id: string;
  strategyId: string;
  promptNumber: number;
  promptName: string;
  userInput: Record<string, string>;
  aiOutput: string;
  createdAt: string;
}

export interface ScriptStrategyContext {
  scriptId: string;
  strategyId: string;
  nicheContext: string;
  audienceContext: string;
  contentPillar: string;
  monetizationAngle: string;
}

// Progress tracking
export interface StrategyProgress {
  stepName: string;
  completed: boolean;
  percentage: number;
}

export type StrategyFormValues = Record<string, string>;
