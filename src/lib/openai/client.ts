import OpenAI from "openai";
import { z } from "zod";
import { getOpenAiCredentials } from "@/lib/db/queries";
import { estimateCost } from "./pricing";

const criterionSchema = z.object({
  requirement: z.string().min(1),
  importance: z.enum(["must", "nice"]),
  status: z.enum(["met", "partial", "missing", "unknown"]),
  evidence: z.string().min(1),
  impact: z.string().min(1),
});

export const analysisSchema = z.object({
  hard_filters_passed: z.boolean(),
  hard_filter_failures: z.array(z.string()),
  criteria: z.array(criterionSchema).min(1),
  hh_folder: z.enum(["fit", "maybe", "not_now"]),
  score: z.number().int().min(0).max(100),
  skills_match: z.number().int().min(0).max(100),
  experience_match: z.number().int().min(0).max(100),
  salary_match: z.number().int().min(0).max(100),
  role_match: z.number().int().min(0).max(100),
  salary_estimate: z.string().min(1),
  salary_estimate_confidence: z.enum(["low", "medium", "high"]),
  salary_estimate_reasoning: z.string().min(1),
  recommendation: z.enum(["high", "medium", "low"]),
  summary: z.string().min(1),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  red_flags: z.array(z.string()),
  clarifying_questions: z.array(z.string()),
  reasoning: z.string().min(1),
});

export type VacancyAnalysisResult = z.infer<typeof analysisSchema>;
export type AnalysisCriterion = z.infer<typeof criterionSchema>;

const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "hard_filters_passed",
    "hard_filter_failures",
    "criteria",
    "hh_folder",
    "score",
    "skills_match",
    "experience_match",
    "salary_match",
    "role_match",
    "salary_estimate",
    "salary_estimate_confidence",
    "salary_estimate_reasoning",
    "recommendation",
    "summary",
    "pros",
    "cons",
    "red_flags",
    "clarifying_questions",
    "reasoning",
  ],
  properties: {
    hard_filters_passed: { type: "boolean" },
    hard_filter_failures: { type: "array", items: { type: "string" } },
    criteria: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["requirement", "importance", "status", "evidence", "impact"],
        properties: {
          requirement: { type: "string" },
          importance: { type: "string", enum: ["must", "nice"] },
          status: { type: "string", enum: ["met", "partial", "missing", "unknown"] },
          evidence: { type: "string" },
          impact: { type: "string" },
        },
      },
    },
    hh_folder: { type: "string", enum: ["fit", "maybe", "not_now"] },
    score: { type: "integer", minimum: 0, maximum: 100 },
    skills_match: { type: "integer", minimum: 0, maximum: 100 },
    experience_match: { type: "integer", minimum: 0, maximum: 100 },
    salary_match: { type: "integer", minimum: 0, maximum: 100 },
    role_match: { type: "integer", minimum: 0, maximum: 100 },
    salary_estimate: { type: "string" },
    salary_estimate_confidence: { type: "string", enum: ["low", "medium", "high"] },
    salary_estimate_reasoning: { type: "string" },
    recommendation: { type: "string", enum: ["high", "medium", "low"] },
    summary: { type: "string" },
    pros: { type: "array", items: { type: "string" } },
    cons: { type: "array", items: { type: "string" } },
    red_flags: { type: "array", items: { type: "string" } },
    clarifying_questions: { type: "array", items: { type: "string" } },
    reasoning: { type: "string" },
  },
} as const;

async function openAi() {
  const credentials = await getOpenAiCredentials();
  if (!credentials) throw new Error("Добавьте OpenAI API-ключ в настройках.");
  return { client: new OpenAI({ apiKey: credentials.apiKey }), model: credentials.model };
}

function mapOpenAiError(error: unknown): never {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429 || /credits? remaining|insufficient_quota|billing/i.test(error.message)) {
      throw new Error("У OpenAI закончились кредиты. Пополните баланс в billing организации.");
    }
    if (error.status === 401) throw new Error("OpenAI отклонил API-ключ. Проверьте ключ в настройках.");
    if (error.status === 404) throw new Error("Указанная модель OpenAI не найдена. Проверьте название модели.");
    throw new Error(`Ошибка OpenAI (${error.status ?? "unknown"}): ${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Неизвестная ошибка OpenAI.");
}

function normalizeFolderRecommendation(analysis: VacancyAnalysisResult): VacancyAnalysisResult {
  const folderFromRecommendation =
    analysis.recommendation === "high" ? "fit" : analysis.recommendation === "medium" ? "maybe" : "not_now";
  const hh_folder = analysis.hard_filters_passed === false ? "not_now" : analysis.hh_folder || folderFromRecommendation;
  const recommendation =
    hh_folder === "fit" ? "high" : hh_folder === "maybe" ? "medium" : "low";
  return { ...analysis, hh_folder, recommendation };
}

export async function analyzeWithOpenAi(prompt: string) {
  const { client, model } = await openAi();
  const started = Date.now();
  let response;
  try {
    response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "vacancy_analysis",
          strict: true,
          schema: analysisJsonSchema,
        },
      },
    });
  } catch (error) {
    mapOpenAiError(error);
  }
  const raw = response.choices[0]?.message.content;
  if (!raw) throw new Error("OpenAI вернул пустой ответ.");
  const usage = response.usage;
  const parsed = normalizeFolderRecommendation(analysisSchema.parse(JSON.parse(raw)));
  return {
    analysis: parsed,
    raw: parsed as unknown,
    model,
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    durationMs: Date.now() - started,
    estimatedCost: estimateCost(model, usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0),
  };
}

export async function createCoverLetterWithOpenAi(prompt: string) {
  const { client, model } = await openAi();
  const started = Date.now();
  let response;
  try {
    response = await client.chat.completions.create({ model, messages: [{ role: "user", content: prompt }] });
  } catch (error) {
    mapOpenAiError(error);
  }
  const content = response.choices[0]?.message.content?.trim();
  if (!content) throw new Error("OpenAI вернул пустой текст письма.");
  const usage = response.usage;
  return { content, model, inputTokens: usage?.prompt_tokens ?? 0, outputTokens: usage?.completion_tokens ?? 0, durationMs: Date.now() - started, estimatedCost: estimateCost(model, usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0) };
}
