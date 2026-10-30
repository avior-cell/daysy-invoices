# הקמה · צעד אחר צעד

כל השלבים חד־פעמיים. סדר מומלץ: Supabase, Google Cloud, Anthropic, Vercel.

## 1. Supabase (מסד נתונים)

1. היכנסו ל־supabase.com והירשמו עם avior@daysy.co.il.
2. **New project**, שם `daysy-invoices`, אזור **Frankfurt (eu-central-1)**. שמרו את סיסמת מסד הנתונים.
3. בתפריט **SQL Editor** הדביקו את כל התוכן של `supabase/schema.sql` ולחצו **Run**.
4. ב־**Project Settings ← API** העתיקו:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (סודי, לא לשתף)

## 2. Google Cloud (Gmail ו־Drive)

1. היכנסו ל־console.cloud.google.com עם avior@daysy.co.il.
2. צרו פרויקט חדש בשם `daysy-invoices`.
3. **APIs & Services ← Library**: הפעילו **Gmail API** ו־**Google Drive API**.
4. **OAuth consent screen**: סוג **Internal** (רק משתמשי daysy.co.il), שם האפליקציה ״מעקב חשבוניות Daysy״.
5. **Credentials ← Create credentials ← OAuth client ID**:
   - סוג: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://<הכתובת-ב-Vercel>/api/auth/callback/google` (נוסיף אחרי שלב 4)
6. העתיקו `Client ID` → `GOOGLE_CLIENT_ID` ו־`Client secret` → `GOOGLE_CLIENT_SECRET`.

## 3. Anthropic (קריאת חשבוניות)

1. היכנסו ל־console.anthropic.com, **API Keys ← Create Key**.
2. העתיקו → `ANTHROPIC_API_KEY`.
3. מומלץ להגדיר תקרת הוצאה חודשית ב־**Billing ← Limits**.

## 4. Vercel (אירוח)

1. היכנסו ל־vercel.com עם GitHub.
2. **Add New ← Project**, בחרו את הריפו `daysy-invoices`.
3. ב־**Environment Variables** הוסיפו את כל המשתנים מ־`.env.example` עם הערכים מהשלבים הקודמים.
4. **Deploy**. העתיקו את הכתובת שקיבלתם, הוסיפו אותה ל־`NEXTAUTH_URL`, וגם ל־Redirect URIs ב־Google Cloud (שלב 2.5).

## 5. Financy

שלחו לתמיכה של Financy / Open-Finance בקשה לגישת API לחשבון של ויוואה קולקטיב, לקריאת תנועות בנק וכרטיסי אשראי. כשמקבלים מפתח: `FINANCY_API_KEY`.

## 6. כניסה ראשונה

1. פתחו את הכתובת ב־Vercel והתחברו עם avior@daysy.co.il.
2. אשרו גישה ל־Gmail ו־Drive.
3. **הגדרות ← סנכרון ← סריקה מלאה.** הסריקה הראשונה רצה ברקע ועשויה לקחת כמה שעות. אפשר לסגור את הדפדפן.
