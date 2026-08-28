"use client";

import { useState, useEffect } from "react";
import { STRATEGY_PROMPTS } from "@/lib/ai/strategy-prompts";
import { StrategyPrompt, StrategyFormValues } from "@/lib/types/strategy";
import { useSession } from "@/lib/auth/use-session";
import { getAuthUserId } from "@/lib/auth/auth-context";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";

export default function YouTubeStrategyStudioPage() {
  const { user } = useSession();
  const [activePrompt, setActivePrompt] = useState(0);
  const [formValues, setFormValues] = useState<Record<string, StrategyFormValues>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [outputs, setOutputs] = useState<Record<number, string>>({});
  const [completedPrompts, setCompletedPrompts] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState<number | null>(null);

  const prompt = STRATEGY_PROMPTS[activePrompt];

  const handleFieldChange = (key: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [activePrompt]: {
        ...prev[activePrompt],
        [key]: value,
      },
    }));
  };

  const getFieldValue = (key: string) => {
    return formValues[activePrompt]?.[key] || "";
  };

  const allFieldsFilled = () => {
    const currentFormValues = formValues[activePrompt] || {};
    return prompt.fields.every((field) => currentFormValues[field.key]?.trim());
  };

  const runPrompt = async () => {
    if (!allFieldsFilled() || !user) return;

    const vals = formValues[activePrompt];
    const userId = getAuthUserId(user);
    if (!userId) return;

    setLoading((prev) => ({ ...prev, [activePrompt]: true }));
    setOutputs((prev) => ({ ...prev, [activePrompt]: "" }));

    try {
      const response = await fetch("/api/strategy/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
          promptNumber: prompt.id,
          formValues: vals,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate strategy");
      }

      const data = await response.json();
      setOutputs((prev) => ({ ...prev, [activePrompt]: data.output }));
      setCompletedPrompts((prev) => new Set([...prev, activePrompt]));
    } catch (error) {
      console.error("Error:", error);
      setOutputs((prev) => ({
        ...prev,
        [activePrompt]: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [activePrompt]: false }));
    }
  };

  const copyToClipboard = (index: number) => {
    navigator.clipboard.writeText(outputs[index] || "");
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  const progressPercentage = (completedPrompts.size / STRATEGY_PROMPTS.length) * 100;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
              Back to Dashboard
            </Link>
          </div>
          <h1 className="text-4xl font-bold mb-2">YouTube Strategy Studio</h1>
          <p className="text-slate-400">Build your complete YouTube channel strategy with AI</p>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">Overall Progress</span>
              <span className="text-sm font-semibold text-amber-400">{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div
                className="bg-amber-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Prompt Navigation */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-2">
              {STRATEGY_PROMPTS.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setActivePrompt(i)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    completedPrompts.has(i)
                      ? "bg-amber-400/20 border border-amber-400"
                      : i === activePrompt
                        ? "bg-amber-400/10 border border-amber-400"
                        : "bg-slate-800 border border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  <div className="text-xs font-mono text-slate-400 mb-1">PROMPT {p.id}</div>
                  <div
                    className={`text-sm font-semibold ${
                      i === activePrompt ? "text-white" : "text-slate-300"
                    }`}
                  >
                    {p.shortTitle}
                  </div>
                  {completedPrompts.has(i) && (
                    <div className="text-xs text-amber-400 mt-1">✓ Complete</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Content */}
          <div className="lg:col-span-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
              {/* Prompt Header */}
              <div className="mb-8">
                <div className="inline-block px-3 py-1 bg-amber-400/10 border border-amber-400 rounded text-xs font-semibold text-amber-400 mb-3">
                  PROMPT {prompt.id}
                </div>
                <h2 className="text-2xl font-bold mb-2">{prompt.title}</h2>
                <p className="text-slate-400">{prompt.description}</p>
              </div>

              {/* Form Fields */}
              <div className="space-y-6 mb-8">
                {prompt.fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-semibold mb-2">{field.label}</label>
                    {field.type === "textarea" ? (
                      <textarea
                        value={getFieldValue(field.key)}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 min-h-24 resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={getFieldValue(field.key)}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Generate Button */}
              <button
                onClick={runPrompt}
                disabled={!allFieldsFilled() || loading[activePrompt]}
                className="w-full bg-amber-400 text-slate-950 font-bold py-3 rounded-lg hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-8"
              >
                {loading[activePrompt] ? "⟳ GENERATING STRATEGY..." : "▶ RUN PROMPT"}
              </button>

              {/* Output Section */}
              {(outputs[activePrompt] || loading[activePrompt]) && (
                <div className="border border-slate-800 rounded-lg p-6 bg-slate-800/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold">
                      {loading[activePrompt] ? "⟳ GENERATING..." : "✓ STRATEGY READY"}
                    </h3>
                    {outputs[activePrompt] && !loading[activePrompt] && (
                      <button
                        onClick={() => copyToClipboard(activePrompt)}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
                      >
                        {copied === activePrompt ? (
                          <>
                            <Check size={16} />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={16} />
                            Copy
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {loading[activePrompt] ? (
                    <div className="h-24 flex items-center justify-center">
                      <div className="animate-pulse text-slate-500">
                        Claude is thinking...
                      </div>
                    </div>
                  ) : (
                    <div
                      className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap text-slate-300 max-h-96 overflow-y-auto"
                      dangerouslySetInnerHTML={{
                        __html: outputs[activePrompt]
                          ?.replace(/\n\n/g, "</p><p>")
                          ?.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                          ?.replace(/\n/g, "<br>") || "",
                      }}
                    />
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-8 pt-8 border-t border-slate-800">
                <button
                  onClick={() => setActivePrompt((p) => Math.max(0, p - 1))}
                  disabled={activePrompt === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>

                <div className="text-sm text-slate-400">
                  Prompt {activePrompt + 1} of {STRATEGY_PROMPTS.length}
                </div>

                <button
                  onClick={() => setActivePrompt((p) => Math.min(STRATEGY_PROMPTS.length - 1, p + 1))}
                  disabled={activePrompt === STRATEGY_PROMPTS.length - 1}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Strategy Summary */}
            {completedPrompts.size > 0 && (
              <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4">Your Strategy Progress</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Niche Finder", complete: completedPrompts.has(0) },
                    { label: "Content Calendar", complete: completedPrompts.has(1) },
                    { label: "Script Writer", complete: completedPrompts.has(2) },
                    { label: "SEO Optimizer", complete: completedPrompts.has(3) },
                    { label: "Monetization", complete: completedPrompts.has(4) },
                    { label: "Shorts Extractor", complete: completedPrompts.has(5) },
                    { label: "Automation SOP", complete: completedPrompts.has(6) },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`p-3 rounded-lg text-sm font-semibold ${
                        item.complete
                          ? "bg-amber-400/20 text-amber-400 border border-amber-400"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {item.complete ? "✓ " : "○ "}
                      {item.label}
                    </div>
                  ))}
                </div>

                {completedPrompts.size === STRATEGY_PROMPTS.length && (
                  <Link
                    href="/dashboard/create"
                    className="mt-6 block w-full text-center bg-amber-400 text-slate-950 font-bold py-3 rounded-lg hover:bg-amber-300 transition-colors"
                  >
                    Ready to Create Videos →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
