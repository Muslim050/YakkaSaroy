import { NextResponse, type NextRequest } from "next/server";
import { availabilityForMonth } from "@/lib/store";

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: "Укажите месяц в формате YYYY-MM" }, { status: 400 });
  }
  const days = await availabilityForMonth(month);
  return NextResponse.json({ month, days }, { headers: { "Cache-Control": "no-store" } });
}
