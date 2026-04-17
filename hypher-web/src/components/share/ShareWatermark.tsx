/**
 * Server-rendered label for public canvas views (not a client component).
 */
export function ShareWatermark() {
  return (
    <div className="share-watermark" aria-hidden>
      <span className="share-watermark-inner">Shared from Hypher · View only</span>
    </div>
  );
}
