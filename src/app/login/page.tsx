"use client";
import { signIn } from "next-auth/react";

export default function Login() {
  return (
    <main className="blue-page" style={{ display: "grid", placeItems: "center", padding: "24px 20px" }}>
      <div style={{ maxWidth: 420, width: "100%", color: "#fff", display: "grid", gap: 18, justifyItems: "center", textAlign: "center" }}>
        <img src="/icon-512.png" alt="באדי, קבלה מחייכת עם חותמת" style={{ width: 220, height: 220, borderRadius: 40, boxShadow: "0 18px 40px rgba(18,22,63,.35)" }} />
        <h1 style={{ fontSize: 38, lineHeight: 1.15, color: "#fff" }}>כל חשבונית<br />מוצאת את מקומה.</h1>
        <p style={{ margin: 0, fontSize: 18, lineHeight: 1.45, color: "#dfe3ff", maxWidth: 320 }}>
          באדי אוסף חשבוניות מהמייל, מהוואטסאפ ומהבנק.
          <br />
          משייך כל אחת לחיוב שלה, ומכין לרו״ח קלסר מלא.
        </p>
        <button className="btn" style={{ width: "100%", minHeight: 58, fontSize: 18, fontWeight: 600, borderRadius: 999, borderColor: "#fff" }} onClick={() => signIn("google", { callbackUrl: "/" })}>
          <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z" />
          </svg>
          כניסה עם Google
        </button>
        <span style={{ fontSize: 17, fontWeight: 600, color: "#fff" }}>דקה אחת, ואפשר להתחיל.</span>
      </div>
    </main>
  );
}
