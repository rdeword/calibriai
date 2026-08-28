import { NextResponse } from "next/server";
import { getSearchRun } from "@/lib/db/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getSearchRun(Number(id));
  if (!run) return NextResponse.json({ error: "Запуск не найден." }, { status: 404 });
  return NextResponse.json(run);
}
