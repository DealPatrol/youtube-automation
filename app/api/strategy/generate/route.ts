import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  getUserStrategy,
  createChannelStrategy,
  updateChannelStrategy,
  saveStrategyOutput,
} from "@/lib/db/strategy-queries";
import { getStrategyPrompt } from "@/lib/ai/strategy-prompts";

export async function POST(request: NextRequest) {
  try {
    // Get user from auth header (bearer value is the user id)
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authHeader.replace("Bearer ", "");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { promptNumber, formValues } = await request.json();

    if (!promptNumber || !formValues) {
      return NextResponse.json(
        { error: "Missing promptNumber or formValues" },
        { status: 400 }
      );
    }

    // Get prompt template
    const prompt = getStrategyPrompt(promptNumber);
    if (!prompt) {
      return NextResponse.json({ error: "Invalid prompt number" }, { status: 400 });
    }

    // Get or create user strategy
    let strategy = await getUserStrategy(userId);
    if (!strategy) {
      strategy = await createChannelStrategy(userId, {
        niche: formValues.niche || "",
        targetAudience: formValues.audience || "",
      });
    }

    if (!strategy) {
      return NextResponse.json({ error: "Failed to create strategy" }, { status: 500 });
    }

    // Build the AI prompt
    const builtPrompt = prompt.buildPrompt(formValues);

    // Call Claude to generate strategy output
    const { text } = await generateText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      prompt: builtPrompt,
      temperature: 0.7,
      maxOutputTokens: 2000,
    });

    // Save the output
    await saveStrategyOutput(strategy.id, promptNumber, prompt.title, formValues, text);

    // Update strategy completion based on prompt
    const completionUpdates: Record<number, string> = {
      1: "nicheCompleted",
      2: "roadmapCompleted",
      5: "monetizationCompleted",
      7: "automationCompleted",
    };

    if (completionUpdates[promptNumber]) {
      const updateKey = completionUpdates[promptNumber];
      await updateChannelStrategy(userId, {
        [updateKey]: true,
      });
    }

    return NextResponse.json({
      success: true,
      output: text,
      strategyId: strategy.id,
    });
  } catch (error) {
    console.error("Strategy generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate strategy" },
      { status: 500 }
    );
  }
}
