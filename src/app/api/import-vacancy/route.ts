import { NextResponse } from "next/server";
import { z } from "zod";
import { importVacancy } from "@/lib/services/import-vacancy";

const schema = z.object({
  title: z.string().trim().min(2).max(500),
  employer: z.string().trim().max(500).optional().nullable(),
  url: z.string().trim().max(2000).optional().nullable(),
  salary: z.string().trim().max(500).optional().nullable(),
  area: z.string().trim().max(500).optional().nullable(),
  workFormat: z.string().trim().max(500).optional().nullable(),
  description: z.string().trim().min(30).max(100_000),
  analyzeImmediately: z.boolean().optional(),
});

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const vacancy = await importVacancy({
      title: body.title,
      employer: body.employer,
      url: body.url || null,
      salary: body.salary,
      area: body.area,
      workFormat: body.workFormat,
      description: body.description,
      source: "extension",
      analyzeImmediately: body.analyzeImmediately ?? false,
    });
    return NextResponse.json(
      { id: vacancy.id, title: vacancy.title, status: vacancy.status },
      { headers: corsHeaders(request) },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Неполные данные вакансии. Откройте страницу самой вакансии, а не список." }, { status: 400, headers: corsHeaders(request) });
    }
    const message = error instanceof Error ? error.message : "Не удалось импортировать вакансию.";
    const status = message.includes("активное резюме") || message.includes("API-ключ") ? 400 : 500;
    return NextResponse.json({ error: message }, { status, headers: corsHeaders(request) });
  }
}
