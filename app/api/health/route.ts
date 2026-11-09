import { DEFAULT_MODEL } from "@/lib/models";
import { isMock } from "@/lib/server/http";
import { pickModel } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { hasKey: Boolean(process.env.ANTHROPIC_API_KEY), mock: isMock(), model: pickModel(undefined) || DEFAULT_MODEL },
    { headers: { "cache-control": "no-store" } },
  );
}
