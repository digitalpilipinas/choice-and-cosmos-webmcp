import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

type User = ReturnType<typeof userEvent.setup>

export async function selectWesternSun(
  user: User,
  sign = 'Leo',
): Promise<void> {
  const toggle = screen.getByRole('checkbox', { name: /western astrology/i })
  if (!(toggle instanceof HTMLInputElement)) {
    throw new Error('expected western lens checkbox')
  }
  if (!toggle.checked) {
    await user.click(toggle)
  }
  const sun = await screen.findByRole('group', { name: 'Sun sign' })
  await user.click(within(sun).getByRole('radio', { name: sign }))
}

export async function selectHumanDesignType(
  user: User,
  typeName: string,
): Promise<void> {
  const toggle = screen.getByRole('checkbox', { name: /human design/i })
  if (!(toggle instanceof HTMLInputElement)) {
    throw new Error('expected human design lens checkbox')
  }
  if (!toggle.checked) {
    await user.click(toggle)
  }
  const group = await screen.findByRole('group', { name: 'Human Design type' })
  await user.click(within(group).getByRole('radio', { name: typeName }))
}
