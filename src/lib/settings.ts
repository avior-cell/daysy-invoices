import { db } from "./db";

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const { data } = await db().from("app_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? null;
}

export async function setSetting(key: string, value: unknown) {
  await db().from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() });
}
