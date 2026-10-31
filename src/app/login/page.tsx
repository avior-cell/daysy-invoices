"use client";
import { signIn } from "next-auth/react";

export default function Login() {
  return (
    <main className="wrap" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="card">
        <h1>Money Buddy</h1>
        <p className="sub">כניסה עם חשבון Google של daysy.co.il. בכניסה הראשונה תתבקשו לאשר גישה ל־Gmail ול־Drive.</p>
        <button className="btn primary" onClick={() => signIn("google", { callbackUrl: "/" })}>
          כניסה עם Google
        </button>
      </div>
    </main>
  );
}
