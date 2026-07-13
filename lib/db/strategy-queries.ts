import { createClient } from "@supabase/supabase-js";
import {
  ChannelStrategy,
  MonetizationStream,
  ContentRoadmapWeek,
  ContentPillar,
  StrategyOutput,
} from "@/lib/types/strategy";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Get or create user's channel strategy
export async function getUserStrategy(userId: string): Promise<ChannelStrategy | null> {
  const { data, error } = await supabase
    .from("channel_strategies")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching strategy:", error);
    return null;
  }

  return (data as ChannelStrategy) || null;
}

// Create new channel strategy
export async function createChannelStrategy(
  userId: string,
  strategy: Partial<ChannelStrategy>
): Promise<ChannelStrategy | null> {
  const { data, error } = await supabase
    .from("channel_strategies")
    .insert([
      {
        user_id: userId,
        ...strategy,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error creating strategy:", error);
    return null;
  }

  return data as ChannelStrategy;
}

// Update channel strategy
export async function updateChannelStrategy(
  userId: string,
  updates: Partial<ChannelStrategy>
): Promise<ChannelStrategy | null> {
  const { data, error } = await supabase
    .from("channel_strategies")
    .update({ ...updates, updated_at: new Date() })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating strategy:", error);
    return null;
  }

  return data as ChannelStrategy;
}

// Save strategy output from AI
export async function saveStrategyOutput(
  strategyId: string,
  promptNumber: number,
  promptName: string,
  userInput: Record<string, string>,
  aiOutput: string
): Promise<StrategyOutput | null> {
  const { data, error } = await supabase
    .from("strategy_outputs")
    .insert([
      {
        strategy_id: strategyId,
        prompt_number: promptNumber,
        prompt_name: promptName,
        user_input: userInput,
        ai_output: aiOutput,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error saving strategy output:", error);
    return null;
  }

  return data as StrategyOutput;
}

// Get strategy output for a specific prompt
export async function getStrategyOutput(
  strategyId: string,
  promptNumber: number
): Promise<StrategyOutput | null> {
  const { data, error } = await supabase
    .from("strategy_outputs")
    .select("*")
    .eq("strategy_id", strategyId)
    .eq("prompt_number", promptNumber)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching strategy output:", error);
    return null;
  }

  return (data as StrategyOutput) || null;
}

// Save content roadmap
export async function saveContentRoadmap(
  strategyId: string,
  weeks: ContentRoadmapWeek[]
): Promise<boolean> {
  const { error } = await supabase.from("content_roadmaps").insert(
    weeks.map((week) => ({
      strategy_id: strategyId,
      ...week,
    }))
  );

  if (error) {
    console.error("Error saving content roadmap:", error);
    return false;
  }

  return true;
}

// Get content roadmap
export async function getContentRoadmap(strategyId: string): Promise<ContentRoadmapWeek[]> {
  const { data, error } = await supabase
    .from("content_roadmaps")
    .select("*")
    .eq("strategy_id", strategyId)
    .order("week_number", { ascending: true });

  if (error) {
    console.error("Error fetching content roadmap:", error);
    return [];
  }

  return (data as ContentRoadmapWeek[]) || [];
}

// Save content pillars
export async function saveContentPillars(
  strategyId: string,
  pillars: ContentPillar[]
): Promise<boolean> {
  const { error } = await supabase.from("content_pillars").insert(
    pillars.map((pillar) => ({
      strategy_id: strategyId,
      ...pillar,
    }))
  );

  if (error) {
    console.error("Error saving content pillars:", error);
    return false;
  }

  return true;
}

// Save monetization plans
export async function saveMonetizationPlans(
  strategyId: string,
  streams: MonetizationStream[]
): Promise<boolean> {
  const { error } = await supabase.from("monetization_plans").insert(
    streams.map((stream) => ({
      strategy_id: strategyId,
      ...stream,
    }))
  );

  if (error) {
    console.error("Error saving monetization plans:", error);
    return false;
  }

  return true;
}

// Get monetization plans
export async function getMonetizationPlans(strategyId: string): Promise<MonetizationStream[]> {
  const { data, error } = await supabase
    .from("monetization_plans")
    .select("*")
    .eq("strategy_id", strategyId);

  if (error) {
    console.error("Error fetching monetization plans:", error);
    return [];
  }

  return (data as MonetizationStream[]) || [];
}

// Link script to strategy for context-aware generation
export async function linkScriptToStrategy(
  scriptId: string,
  strategyId: string,
  nicheContext: string,
  audienceContext: string,
  contentPillar: string,
  monetizationAngle: string
): Promise<boolean> {
  const { error } = await supabase.from("script_strategy_context").insert([
    {
      script_id: scriptId,
      strategy_id: strategyId,
      niche_context: nicheContext,
      audience_context: audienceContext,
      content_pillar: contentPillar,
      monetization_angle: monetizationAngle,
    },
  ]);

  if (error) {
    console.error("Error linking script to strategy:", error);
    return false;
  }

  return true;
}

// Get strategy context for a script
export async function getScriptStrategyContext(scriptId: string) {
  const { data, error } = await supabase
    .from("script_strategy_context")
    .select("*")
    .eq("script_id", scriptId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching script strategy context:", error);
    return null;
  }

  return data || null;
}
