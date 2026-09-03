import { NextResponse } from "next/server";
import { exportPrometheus } from "@/lib/observability/metrics";

export async function GET() {
  const output = exportPrometheus();
  return new NextResponse(output, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}