import { google } from "googleapis";
import { db } from "./db";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose", // drafts for "request invoice from vendor"
  "https://www.googleapis.com/auth/drive",
];

/** OAuth client authorized as the given mailbox, from the refresh token stored at sign-in. */
export async function googleAuthFor(email: string) {
  const { data, error } = await db().from("google_accounts").select("refresh_token").eq("email", email).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No Google authorization stored for ${email}. Sign in once as ${email}.`);
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: data.refresh_token });
  return auth;
}

export async function gmailFor(email: string) {
  return google.gmail({ version: "v1", auth: await googleAuthFor(email) });
}

export async function driveFor(email: string) {
  return google.drive({ version: "v3", auth: await googleAuthFor(email) });
}
