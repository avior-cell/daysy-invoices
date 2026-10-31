import { getSetting, setSetting } from "./settings";

/** How Buddy addresses each person. Hebrew needs it: "צלם" or "צלמי". Chosen by the user, never guessed. */
export type Gender = "m" | "f";
export type Me = { email: string; name: string; g: Gender; isSet: boolean };

const key = (email: string) => `user:${email.toLowerCase()}`;
const fallbackName = (email: string) => email.split("@")[0].replace(/[._-].*$/, "").replace(/^./, (c) => c.toUpperCase());

export async function getMe(email: string): Promise<Me> {
  const p = await getSetting<{ name?: string; g?: Gender }>(key(email));
  return { email, name: p?.name || fallbackName(email), g: p?.g === "f" ? "f" : "m", isSet: !!p?.g };
}

export async function saveMe(email: string, name: string, g: Gender) {
  await setSetting(key(email), { name: name.trim().slice(0, 40) || fallbackName(email), g });
}

/** Pick the masculine or feminine form: v(me.g, "צלם", "צלמי"). */
export const v = (g: Gender, m: string, f: string) => (g === "f" ? f : m);
