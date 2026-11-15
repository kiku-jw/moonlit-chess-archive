import { env } from "cloudflare:workers";
import { handleGame } from "@/lib/server-game";
export async function GET(request: Request) {
  if (!env.DB) return Response.json({error:"Хранилище временно недоступно",code:"unavailable"},{status:503});
  return handleGame(request, env.DB);
}
