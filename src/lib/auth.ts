import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "./db";
import { GOOGLE_SCOPES } from "./google";

const DOMAIN = process.env.ALLOWED_DOMAIN || "daysy.co.il";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: { scope: GOOGLE_SCOPES.join(" "), access_type: "offline", prompt: "consent", hd: DOMAIN },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ account, profile }) {
      const email = (profile?.email || "").toLowerCase();
      if (!email.endsWith("@" + DOMAIN)) return false;
      // Keep the refresh token so nightly sync can act as this mailbox
      if (account?.refresh_token) {
        await db().from("google_accounts").upsert({
          email,
          refresh_token: account.refresh_token,
          scopes: account.scope,
          updated_at: new Date().toISOString(),
        });
      }
      return true;
    },
  },
  pages: { signIn: "/login" },
};
