import { useLayoutEffect, useRef, useState } from 'react'
import { persistSessionOffered, profileUpdateDiff } from '../domain/selectors.ts'
import type {
  AgentAvailability,
  ChoicePlanDraft,
  ConfirmationState,
  PersonProfile,
  PersistenceStatus,
} from '../domain/types.ts'

interface AgentBarProps {
  availability: AgentAvailability
  confirmation: ConfirmationState
  profile: PersonProfile
  plan: ChoicePlanDraft | null
  persistence: PersistenceStatus
  onApprove: (id: string, persistSession: boolean) => void
  onDeny: (id: string) => void
}

export function AgentBar({
  availability,
  confirmation,
  profile,
  plan,
  persistence,
  onApprove,
  onDeny,
}: AgentBarProps) {
  return (
    <section className="agent-bar" aria-label="Agent tools">
      <AvailabilityBody availability={availability} />
      <ConfirmationBody
        confirmation={confirmation}
        profile={profile}
        plan={plan}
        persistence={persistence}
        onApprove={onApprove}
        onDeny={onDeny}
      />
    </section>
  )
}

function AvailabilityBody({ availability }: { availability: AgentAvailability }) {
  switch (availability.kind) {
    case 'checking':
      return (
        <p role="status">Checking whether this browser can offer agent tools…</p>
      )
    case 'unavailable':
      return (
        <p role="status">
          {availability.reason} Use the screens by hand. Saving still uses the
          control above.
        </p>
      )
    case 'ready':
      return (
        <p role="status">
          Agent tools are available in this browser. Profile access, research
          briefs, packet adoption, and plan saving still need your confirmation
          on this page. An agent cannot approve itself.
        </p>
      )
    default: {
      const _exhaustive: never = availability
      return _exhaustive
    }
  }
}

function ConfirmationBody({
  confirmation,
  profile,
  plan,
  persistence,
  onApprove,
  onDeny,
}: {
  confirmation: ConfirmationState
  profile: PersonProfile
  plan: ChoicePlanDraft | null
  persistence: PersistenceStatus
  onApprove: (id: string, persistSession: boolean) => void
  onDeny: (id: string) => void
}) {
  if (confirmation.status !== 'pending') {
    return null
  }

  return (
    <PendingConfirm
      key={confirmation.id}
      confirmation={confirmation}
      profile={profile}
      plan={plan}
      persistence={persistence}
      onApprove={onApprove}
      onDeny={onDeny}
    />
  )
}

function PendingConfirm({
  confirmation,
  profile,
  plan,
  persistence,
  onApprove,
  onDeny,
}: {
  confirmation: Extract<ConfirmationState, { status: 'pending' }>
  profile: PersonProfile
  plan: ChoicePlanDraft | null
  persistence: PersistenceStatus
  onApprove: (id: string, persistSession: boolean) => void
  onDeny: (id: string) => void
}) {
  const [persistSession, setPersistSession] = useState(false)
  const offerPersist = persistSessionOffered(confirmation, persistence)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const approveRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const onDenyRef = useRef(onDeny)
  const armedRef = useRef(false)
  const pointerOnApproveRef = useRef(false)
  const keyOnApproveRef = useRef(false)
  const titleId = `confirm-title-${confirmation.id}`
  const descriptionId = `confirm-desc-${confirmation.id}`

  useLayoutEffect(() => {
    onDenyRef.current = onDeny
  })

  useLayoutEffect(() => {
    armedRef.current = false
    pointerOnApproveRef.current = false
    keyOnApproveRef.current = false
    const timer = window.setTimeout(() => {
      armedRef.current = true
    }, 0)
    return () => window.clearTimeout(timer)
  }, [confirmation.id])

  useLayoutEffect(() => {
    const node = dialogRef.current
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    restoreFocusRef.current = previous
    const inerted: HTMLElement[] = []
    const shell = node?.closest('.app-shell')
    if (shell !== null && shell !== undefined) {
      for (const child of shell.children) {
        if (!(child instanceof HTMLElement) || child.contains(node)) {
          continue
        }
        if (child.hasAttribute('inert')) {
          continue
        }
        child.setAttribute('inert', '')
        inerted.push(child)
      }
    }
    if (node !== null) {
      if (typeof node.showModal === 'function') {
        if (!node.open) {
          node.showModal()
        }
      } else {
        node.open = true
      }
    }
    approveRef.current?.focus()

    const onCancel = (event: Event) => {
      event.preventDefault()
      onDenyRef.current(confirmation.id)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDenyRef.current(confirmation.id)
        return
      }
      if (event.key !== 'Tab') {
        return
      }
      const root = dialogRef.current
      if (root === null) {
        return
      }
      const focusable = [
        ...root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ]
      if (focusable.length === 0) {
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (first === undefined || last === undefined) {
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
        return
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    node?.addEventListener('cancel', onCancel)
    document.addEventListener('keydown', onKeyDown)
    const blockOutside = (event: Event) => {
      if (node === null || !(event.target instanceof Node) || node.contains(event.target)) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
    }
    document.addEventListener('pointerdown', blockOutside, true)
    document.addEventListener('click', blockOutside, true)
    return () => {
      node?.removeEventListener('cancel', onCancel)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', blockOutside, true)
      document.removeEventListener('click', blockOutside, true)
      for (const child of inerted) {
        child.removeAttribute('inert')
      }
      if (node !== null && node.open) {
        if (typeof node.close === 'function') {
          node.close()
        } else {
          node.open = false
        }
      }
      restoreFocusRef.current?.focus()
    }
  }, [confirmation.id])

  return (
    <dialog
      ref={dialogRef}
      className="agent-confirm"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <h3 id={titleId}>Confirm this agent request</h3>
      <p id={descriptionId} role="status">
        {confirmation.summary}
      </p>
      <HumanPreview confirmation={confirmation} profile={profile} plan={plan} />
      {offerPersist ? (
        <label className="persist-offer">
          <input
            type="checkbox"
            checked={persistSession}
            onChange={(event) => setPersistSession(event.target.checked)}
          />
          Also save this session in this browser. Leave this unchecked to approve
          the plan in memory only.
        </label>
      ) : null}
      <div className="persistence-actions">
        <button
          ref={approveRef}
          type="button"
          className="primary"
          onPointerDown={() => {
            pointerOnApproveRef.current = true
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              keyOnApproveRef.current = true
            }
          }}
          onClick={() => {
            if (!armedRef.current) {
              return
            }
            const fromPointer = pointerOnApproveRef.current
            const fromKey = keyOnApproveRef.current
            pointerOnApproveRef.current = false
            keyOnApproveRef.current = false
            if (!fromPointer && !fromKey) {
              return
            }
            onApprove(confirmation.id, offerPersist && persistSession)
          }}
        >
          Approve this request
        </button>
        <button type="button" onClick={() => onDeny(confirmation.id)}>
          Deny
        </button>
      </div>
    </dialog>
  )
}

function HumanPreview({
  confirmation,
  profile,
  plan,
}: {
  confirmation: ConfirmationState
  profile: PersonProfile
  plan: ChoicePlanDraft | null
}) {
  if (confirmation.status !== 'pending') {
    return null
  }

  if (
    confirmation.kind === 'profile_update' &&
    confirmation.payload.kind === 'profile_update'
  ) {
    const diffs = profileUpdateDiff(profile, confirmation.payload.proposed)
    return (
      <dl className="gate-preview">
        {diffs.map((diff) => (
          <div key={diff.field}>
            <dt>{diff.label}</dt>
            <dd>
              {diff.from} to {diff.to}
            </dd>
          </div>
        ))}
      </dl>
    )
  }

  if (
    confirmation.kind === 'research_brief' &&
    confirmation.payload.kind === 'research_brief'
  ) {
    const snapshot = confirmation.payload.snapshot
    return (
      <dl className="gate-preview">
        <div>
          <dt>Horizon</dt>
          <dd>{confirmation.payload.horizon}</dd>
        </div>
        <div>
          <dt>Focus</dt>
          <dd>{snapshot.focus.trim() || 'None written'}</dd>
        </div>
        <div>
          <dt>Tone</dt>
          <dd>{snapshot.tone}</dd>
        </div>
        <div>
          <dt>Requested lenses</dt>
          <dd>{snapshot.requestedLenses.join(', ') || 'None'}</dd>
        </div>
        <div>
          <dt>Skipped lenses</dt>
          <dd>{snapshot.skippedLenses.join(', ') || 'None'}</dd>
        </div>
        <div>
          <dt>Brief digest</dt>
          <dd>{confirmation.payload.briefDigest}</dd>
        </div>
      </dl>
    )
  }

  if (confirmation.kind === 'personal_data_access') {
    const fields =
      confirmation.payload.kind === 'personal_data_access'
        ? (confirmation.payload.fields ?? [
            'displayName',
            'focusIntention',
            'tone',
          ])
        : ['displayName', 'focusIntention', 'tone']
    return (
      <dl className="gate-preview">
        {fields.includes('displayName') ? (
          <div>
            <dt>Display name</dt>
            <dd>{profile.displayName}</dd>
          </div>
        ) : null}
        {fields.includes('focusIntention') ? (
          <div>
            <dt>Focus intention</dt>
            <dd>{profile.focusIntention.trim() || 'None written'}</dd>
          </div>
        ) : null}
        {fields.includes('tone') ? (
          <div>
            <dt>Tone</dt>
            <dd>{profile.tone}</dd>
          </div>
        ) : null}
        {fields.some((field) => field.startsWith('beliefs.')) ? (
          <div>
            <dt>Belief modules</dt>
            <dd>
              {fields
                .filter((field) => field.startsWith('beliefs.'))
                .join(', ')}
            </dd>
          </div>
        ) : null}
      </dl>
    )
  }

  if (confirmation.kind === 'plan_save' && plan !== null) {
    return (
      <ul className="gate-preview" aria-label="Plan steps to approve">
        {plan.steps.map((step) => (
          <li key={step.id}>
            {step.title} ({step.status})
          </li>
        ))}
      </ul>
    )
  }

  if (confirmation.kind === 'adopt_reading' && confirmation.payload.kind === 'adopt_reading') {
    return (
      <dl className="gate-preview">
        <div>
          <dt>Horizon</dt>
          <dd>{confirmation.payload.horizon}</dd>
        </div>
        <div>
          <dt>Packet digest</dt>
          <dd>{confirmation.payload.packetDigest}</dd>
        </div>
        <div>
          <dt>Adoption</dt>
          <dd>
            This packet stays a review until you approve. It is not an exhaustive
            search.
          </dd>
        </div>
      </dl>
    )
  }

  return null
}
