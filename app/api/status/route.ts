export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({
    configured: Boolean(process.env.SARVAM_API_KEY?.trim()),
  });
}
