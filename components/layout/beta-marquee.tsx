export function BetaMarquee() {
  const message = "BETA TESTING • LIVE LAUNCH AT 22 APRIL 2026";

  return (
    <div className="beta-marquee" aria-label={message}>
      <div className="beta-marquee__track">
        <div className="beta-marquee__group">
          <span>{message}</span>
          <span aria-hidden="true">{message}</span>
          <span aria-hidden="true">{message}</span>
        </div>
        <div className="beta-marquee__group" aria-hidden="true">
          <span>{message}</span>
          <span>{message}</span>
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
}
