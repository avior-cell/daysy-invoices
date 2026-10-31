/** Daysy's wave header: optional Buddy, one line above, the headline, and the one number that matters in a pill. */
export default function Hero({ title, hi, pill, buddy, small }: { title: string; hi?: React.ReactNode; pill?: React.ReactNode; buddy?: boolean; small?: boolean }) {
  return (
    <section className={`wave-hero${small ? " small" : ""}`}>
      {buddy && <img className="buddy" src="/buddy.jpg" alt="באדי, חשבונית מחייכת" />}
      {hi && <div className="hi">{hi}</div>}
      <h1>{title}</h1>
      {pill && <div className="offer">{pill}</div>}
    </section>
  );
}
