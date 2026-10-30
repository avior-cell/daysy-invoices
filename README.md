# daysy-invoices

מעקב חשבוניות לויוואה קולקטיב בע״מ (Daysy Israel). כל הוצאה בבנק ובאשראי מול חשבונית בתיקיית Drive של החודש.

- **אפיון:** [docs/SPEC.md](docs/SPEC.md)
- **הקמה:** [docs/SETUP.md](docs/SETUP.md)

## פיתוח מקומי

```bash
cp .env.example .env.local   # למלא ערכים
npm install
npm run dev
```

## מבנה

```
src/app/          מסכים ו־API routes
src/lib/gmail.ts  סריקת Gmail מלאה ומצטברת
src/lib/extract.ts קריאת PDF ותמונות, שליפת פרטי חשבונית
src/lib/links.ts  זיהוי והורדה של חשבוניות מקישורים
src/lib/drive.ts  תיוק בתיקיות חודש
src/lib/classify.ts החרגות
src/lib/match.ts  התאמת הוצאות לחשבוניות
supabase/schema.sql מבנה מסד הנתונים
```
