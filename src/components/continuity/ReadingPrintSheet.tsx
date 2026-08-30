import type { PrintSheetModel } from '../../domain/studioView.ts'

export function ReadingPrintSheet({ sheet }: { sheet: PrintSheetModel }) {
  return (
    <article className="print-sheet" aria-hidden="true">
      <h1>{sheet.title}</h1>
      <p>
        {sheet.horizonLabel} · {sheet.windowDescription}
      </p>
      <p>Focus: {sheet.focusIntention}</p>
      <p>{sheet.digestLine}</p>
      <p>Adopted at {sheet.adoptedAt}</p>
      {sheet.sections.map((section) => (
        <section key={section.id}>
          <h2>{section.title}</h2>
          <p>{section.frameworkLabel}</p>
          <p>{section.reflection}</p>
          {section.evidence.length > 0 ? (
            <ul>
              {section.evidence.map((card) => (
                <li key={card.id}>
                  {card.label}
                  {card.url !== null ? (
                    <>
                      {' '}
                      <a href={card.url}>{card.urlLabel}</a>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      <section>
        <h2>Sources</h2>
        <ul>
          {sheet.evidence.map((card) => (
            <li key={card.id}>
              {card.label}
              {card.url !== null ? (
                <>
                  {' '}
                  <a href={card.url}>{card.url}</a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      {sheet.skippedLenses.length > 0 ? (
        <section>
          <h2>Skipped systems</h2>
          <ul>
            {sheet.skippedLenses.map((item) => (
              <li key={item.lens}>{item.reason}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h2>{sheet.coverage.heading}</h2>
        <p>{sheet.coverage.modeCopy}</p>
        <p>{sheet.coverage.stoppingReason}</p>
        <p>{sheet.limitations}</p>
      </section>
      <p>{sheet.freeWillNote}</p>
      <section>
        <h2>Accepted steps</h2>
        {sheet.acceptedSteps.length === 0 ? (
          <p>You did not accept any suggested step.</p>
        ) : (
          <ol>
            {sheet.acceptedSteps.map((step) => (
              <li key={step.id}>
                {step.title}
                {step.userNote.trim() ? <p>{step.userNote.trim()}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  )
}
