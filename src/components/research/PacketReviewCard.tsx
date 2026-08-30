import type { PacketReview } from '../../research/coordinator.ts'

export function PacketReviewCard({ review }: { review: PacketReview }) {
  return (
    <section aria-labelledby="packet-review-heading">
      <h4 id="packet-review-heading">Validation review</h4>
      <p>
        {review.sourceCount} sources and {review.sectionCount} sections passed
        strict ReadingPacketV1 checks. {review.stoppingReason}
      </p>
      {review.untrustedAsData ? (
        <p>
          Some packet text looks like an instruction. It is held as untrusted
          data and cannot change caps, consent, or adoption.
        </p>
      ) : null}
      <h4>Supported systems</h4>
      {review.supported.length === 0 ? (
        <p>No belief-system sections in this packet match the current profile.</p>
      ) : (
        <ul>
          {review.supported.map((lens) => (
            <li key={lens}>{lens}</li>
          ))}
        </ul>
      )}
      <h4>Skipped systems</h4>
      {review.skipped.length === 0 ? (
        <p>No listed systems were skipped.</p>
      ) : (
        <ul>
          {review.skipped.map((item) => (
            <li key={item.lens}>
              {item.lens}: {item.reason}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
