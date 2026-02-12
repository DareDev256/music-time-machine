import { getCatalog } from "@/lib/dataFetcher";
import { withRouteHandler, jsonWithCache } from "@/lib/apiHandler";

export const GET = withRouteHandler({ route: "catalog" }, async () => {
  const catalog = getCatalog();
  return jsonWithCache(catalog, "public, s-maxage=86400, stale-while-revalidate=3600");
});
