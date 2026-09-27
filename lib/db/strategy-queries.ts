import { sql } from "drizzle-orm";
import { docs } from "@/lib/db/client";
import { updateColumns } from "@/lib/db/mutate";
import { ensureAppUser } from "@/lib/db/users";
import {
  ChannelStrategy,
  MonetizationStream,
  ContentRoadmapWeek,
  ContentPillar,
  StrategyOutput,
} from "@/lib/types/strategy";

const STRATEGY_COLUMNS = new Set([
  "channel_name",
  "channel_tagline",
  "niche",
  "target_audience",
  "posting_frequency",
  "interests",
  "goals",
  "time_available",
  "monetization_potential",
  "competition_level",
  "niche_completed",
  "roadmap_completed",
  "monetization_completed",
  "automation_completed",
]);

const STRATEGY_FIELD_MAP: Record<string, string> = {
  userId: "user_id",
  channelName: "channel_name",
  channelTagline: "channel_tagline",
  targetAudience: "target_audience",
  postingFrequency: "posting_frequency",
  timeAvailable: "time_available",
  monetizationPotential: "monetization_potential",
  competitionLevel: "competition_level",
  nicheCompleted: "niche_completed",
  roadmapCompleted: "roadmap_completed",
  monetizationCompleted: "monetization_completed",
  automationCompleted: "automation_completed",
  channel_name: "channel_name",
  channel_tagline: "channel_tagline",
  niche: "niche",
  target_audience: "target_audience",
  posting_frequency: "posting_frequency",
  interests: "interests",
  goals: "goals",
  time_available: "time_available",
  monetization_potential: "monetization_potential",
  competition_level: "competition_level",
  niche_completed: "niche_completed",
  roadmap_completed: "roadmap_completed",
  monetization_completed: "monetization_completed",
  automation_completed: "automation_completed",
};

function toStrategyPatch(input: Partial<ChannelStrategy> | Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const column = STRATEGY_FIELD_MAP[key];
    if (!column || value === undefined) continue;
    patch[column] = value;
  }
  return patch;
}

function mapStrategy(row: Record<string, unknown>): ChannelStrategy {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    channelName: String(row.channel_name ?? ""),
    channelTagline: String(row.channel_tagline ?? ""),
    niche: String(row.niche ?? ""),
    targetAudience: String(row.target_audience ?? ""),
    postingFrequency: String(row.posting_frequency ?? ""),
    interests: String(row.interests ?? ""),
    goals: String(row.goals ?? ""),
    timeAvailable: String(row.time_available ?? ""),
    monetizationPotential: Number(row.monetization_potential ?? 0),
    competitionLevel: String(row.competition_level ?? ""),
    nicheCompleted: Boolean(row.niche_completed),
    roadmapCompleted: Boolean(row.roadmap_completed),
    monetizationCompleted: Boolean(row.monetization_completed),
    automationCompleted: Boolean(row.automation_completed),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapStrategyOutput(row: Record<string, unknown>): StrategyOutput {
  return {
    id: String(row.id),
    strategyId: String(row.strategy_id),
    promptNumber: Number(row.prompt_number),
    promptName: String(row.prompt_name),
    userInput: (row.user_input as Record<string, string>) ?? {},
    aiOutput: String(row.ai_output ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export async function getUserStrategy(userId: string): Promise<ChannelStrategy | null> {
  const [row] = await docs<Record<string, unknown>>(sql`
    SELECT to_jsonb(channel_strategies.*) AS doc
    FROM channel_strategies
    WHERE user_id = ${userId}
  `);
  return row ? mapStrategy(row) : null;
}

export async function createChannelStrategy(
  userId: string,
  strategy: Partial<ChannelStrategy>
): Promise<ChannelStrategy | null> {
  try {
    await ensureAppUser({ id: userId });
    const patch = toStrategyPatch(strategy);
    const [row] = await docs<Record<string, unknown>>(sql`
      INSERT INTO channel_strategies (
        user_id, channel_name, channel_tagline, niche, target_audience, posting_frequency,
        interests, goals, time_available, monetization_potential, competition_level
      ) VALUES (
        ${userId},
        ${(patch.channel_name as string) ?? null},
        ${(patch.channel_tagline as string) ?? null},
        ${(patch.niche as string) || "general"},
        ${(patch.target_audience as string) ?? null},
        ${(patch.posting_frequency as string) ?? null},
        ${(patch.interests as string) ?? null},
        ${(patch.goals as string) ?? null},
        ${(patch.time_available as string) ?? null},
        ${(patch.monetization_potential as number) ?? null},
        ${(patch.competition_level as string) ?? null}
      )
      RETURNING to_jsonb(channel_strategies.*) AS doc
    `);
    return row ? mapStrategy(row) : null;
  } catch (error) {
    console.error("Error creating strategy:", error);
    return null;
  }
}

export async function updateChannelStrategy(
  userId: string,
  updates: Partial<ChannelStrategy>
): Promise<ChannelStrategy | null> {
  try {
    const count = await updateColumns(
      "channel_strategies",
      toStrategyPatch(updates),
      STRATEGY_COLUMNS,
      new Set(),
      [{ column: "user_id", value: userId }]
    );
    if (count === 0) return null;
    return getUserStrategy(userId);
  } catch (error) {
    console.error("Error updating strategy:", error);
    return null;
  }
}

export async function saveStrategyOutput(
  strategyId: string,
  promptNumber: number,
  promptName: string,
  userInput: Record<string, string>,
  aiOutput: string
): Promise<StrategyOutput | null> {
  try {
    const [row] = await docs<Record<string, unknown>>(sql`
      INSERT INTO strategy_outputs (strategy_id, prompt_number, prompt_name, user_input, ai_output)
      VALUES (${strategyId}, ${promptNumber}, ${promptName}, ${JSON.stringify(userInput)}::jsonb, ${aiOutput})
      RETURNING to_jsonb(strategy_outputs.*) AS doc
    `);
    return row ? mapStrategyOutput(row) : null;
  } catch (error) {
    console.error("Error saving strategy output:", error);
    return null;
  }
}

export async function getStrategyOutput(
  strategyId: string,
  promptNumber: number
): Promise<StrategyOutput | null> {
  const [row] = await docs<Record<string, unknown>>(sql`
    SELECT to_jsonb(strategy_outputs.*) AS doc
    FROM strategy_outputs
    WHERE strategy_id = ${strategyId} AND prompt_number = ${promptNumber}
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return row ? mapStrategyOutput(row) : null;
}

export async function saveContentRoadmap(
  strategyId: string,
  weeks: ContentRoadmapWeek[]
): Promise<boolean> {
  try {
    for (const week of weeks) {
      await docs(sql`
        INSERT INTO content_roadmaps (
          strategy_id, week_number, video_title, video_type, seo_notes, shorts_description
        ) VALUES (
          ${strategyId},
          ${week.weekNumber},
          ${week.videoTitle},
          ${week.videoType},
          ${week.seoNotes},
          ${week.shortsDescription}
        )
      `);
    }
    return true;
  } catch (error) {
    console.error("Error saving content roadmap:", error);
    return false;
  }
}

export async function getContentRoadmap(strategyId: string): Promise<ContentRoadmapWeek[]> {
  const result = await docs<Record<string, unknown>>(sql`
    SELECT to_jsonb(content_roadmaps.*) AS doc
    FROM content_roadmaps
    WHERE strategy_id = ${strategyId}
    ORDER BY week_number ASC
  `);
  return result.map((row) => ({
    weekNumber: Number(row.week_number),
    videoTitle: String(row.video_title ?? ""),
    videoType: row.video_type as ContentRoadmapWeek["videoType"],
    seoNotes: String(row.seo_notes ?? ""),
    shortsDescription: String(row.shorts_description ?? ""),
  }));
}

export async function saveContentPillars(strategyId: string, pillars: ContentPillar[]): Promise<boolean> {
  try {
    for (const pillar of pillars) {
      await docs(sql`
        INSERT INTO content_pillars (strategy_id, pillar_name, pillar_description, percentage)
        VALUES (${strategyId}, ${pillar.pillarName}, ${pillar.pillarDescription}, ${pillar.percentage})
      `);
    }
    return true;
  } catch (error) {
    console.error("Error saving content pillars:", error);
    return false;
  }
}

export async function saveMonetizationPlans(
  strategyId: string,
  streams: MonetizationStream[]
): Promise<boolean> {
  try {
    for (const stream of streams) {
      await docs(sql`
        INSERT INTO monetization_plans (
          strategy_id, revenue_stream, estimated_revenue, monthly_budget, notes
        ) VALUES (
          ${strategyId},
          ${stream.revenueStream},
          ${stream.estimatedRevenue},
          ${stream.monthlyBudget},
          ${stream.notes}
        )
      `);
    }
    return true;
  } catch (error) {
    console.error("Error saving monetization plans:", error);
    return false;
  }
}

export async function getMonetizationPlans(strategyId: string): Promise<MonetizationStream[]> {
  const result = await docs<Record<string, unknown>>(sql`
    SELECT to_jsonb(monetization_plans.*) AS doc
    FROM monetization_plans
    WHERE strategy_id = ${strategyId}
  `);
  return result.map((row) => ({
    revenueStream: row.revenue_stream as MonetizationStream["revenueStream"],
    estimatedRevenue: Number(row.estimated_revenue ?? 0),
    monthlyBudget: Number(row.monthly_budget ?? 0),
    notes: String(row.notes ?? ""),
  }));
}

export async function linkScriptToStrategy(
  scriptId: string,
  strategyId: string,
  nicheContext: string,
  audienceContext: string,
  contentPillar: string,
  monetizationAngle: string
): Promise<boolean> {
  try {
    await docs(sql`
      INSERT INTO script_strategy_context (
        script_id, strategy_id, niche_context, audience_context, content_pillar, monetization_angle
      ) VALUES (
        ${scriptId}, ${strategyId}, ${nicheContext}, ${audienceContext}, ${contentPillar}, ${monetizationAngle}
      )
    `);
    return true;
  } catch (error) {
    console.error("Error linking script to strategy:", error);
    return false;
  }
}

export async function getScriptStrategyContext(scriptId: string) {
  const [row] = await docs<Record<string, unknown>>(sql`
    SELECT to_jsonb(script_strategy_context.*) AS doc
    FROM script_strategy_context
    WHERE script_id = ${scriptId}
    LIMIT 1
  `);
  if (!row) return null;
  return {
    scriptId: row.script_id,
    strategyId: row.strategy_id,
    nicheContext: row.niche_context,
    audienceContext: row.audience_context,
    contentPillar: row.content_pillar,
    monetizationAngle: row.monetization_angle,
  };
}
