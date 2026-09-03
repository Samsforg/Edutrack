import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      version: process.env.npm_package_version ?? "0.1.0",
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}