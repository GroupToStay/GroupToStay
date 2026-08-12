function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    const missing = [
      ...(!url ? ["NEXT_PUBLIC_SUPABASE_URL"] : []),
      ...(!key ? ["NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}.`);
  }

  return { key, restUrl: `${url.replace(/\/$/, "")}/rest/v1` };
}

function buildRestUrl(
  table: string,
  params: Record<string, string | number | boolean | undefined>,
) {
  const { restUrl } = getSupabasePublicConfig();
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });

  return `${restUrl}/${table}?${search.toString()}`;
}

function headers(accessToken?: string, extra?: HeadersInit) {
  const { key } = getSupabasePublicConfig();

  return {
    apikey: key,
    Authorization: `Bearer ${accessToken ?? key}`,
    Accept: "application/json",
    ...extra,
  };
}

export async function fetchPublicRows<T>(
  table: string,
  params: Record<string, string | number | boolean | undefined>,
  options?: { accessToken?: string },
): Promise<T[]> {
  const response = await fetch(buildRestUrl(table, params), {
    headers: headers(options?.accessToken),
  });

  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as T[];
}

export async function fetchPublicCount(
  table: string,
  params: Record<string, string | number | boolean | undefined>,
  options?: { accessToken?: string },
): Promise<number> {
  const response = await fetch(buildRestUrl(table, params), {
    headers: headers(options?.accessToken, {
      Prefer: "count=exact",
      Range: "0-0",
    }),
  });

  if (!response.ok) throw new Error(await response.text());

  const contentRange = response.headers.get("content-range");
  const count = contentRange?.split("/")?.[1];
  return count && count !== "*" ? Number(count) : 0;
}
