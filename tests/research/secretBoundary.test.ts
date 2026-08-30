import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TOOL_NAMES } from '../../src/webmcp/catalog.ts'

const srcModules = import.meta.glob('../../src/**/*.{ts,tsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const serverModules = import.meta.glob('../../server/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function walkBundleFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return []
  }
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      out.push(...walkBundleFiles(full))
      continue
    }
    if (/\.(js|css|html|mjs)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

describe('secret boundary', () => {
  it('keeps the Gemini key, authorization header, and server adapter out of src', () => {
    const files = Object.entries(srcModules)
    expect(files.length).toBeGreaterThan(0)
    for (const [path, text] of files) {
      expect(text, path).not.toMatch(/x-goog-api-key/i)
      expect(text, path).not.toMatch(/generativelanguage\.googleapis\.com/)
      expect(text, path).not.toMatch(/GEMINI_API_KEY/)
      expect(text, path).not.toMatch(/from ['"][^'"]*server\//)
    }
  })

  it('keeps the Interactions URL on the server side only', () => {
    const serverText = Object.values(serverModules).join('\n')
    expect(serverText).toContain('https://generativelanguage.googleapis.com/v1beta/interactions')
    expect(serverText).toMatch(/x-goog-api-key/)
  })

  it('does not put the Interactions URL or API header into the client bundle when dist exists', () => {
    const distRoot = join(process.cwd(), 'dist', 'client')
    expect(
      existsSync(distRoot),
      'dist/client is missing. Run npm run build before this secret scan.',
    ).toBe(true)
    const files = walkBundleFiles(distRoot)
    expect(
      files.length,
      'dist has no js, css, html, or mjs files to scan.',
    ).toBeGreaterThan(0)
    for (const path of files) {
      const text = readFileSync(path, 'utf8')
      expect(text, path).not.toMatch(/x-goog-api-key/i)
      expect(text, path).not.toMatch(/generativelanguage\.googleapis\.com/)
      expect(text, path).not.toContain('GEMINI_API_KEY')
    }
  })

  it('registers the V3-4 eight-tool catalog', () => {
    expect(TOOL_NAMES).toEqual([
      'get_session_status',
      'request_profile_access',
      'propose_profile_update',
      'get_research_brief',
      'submit_reading_packet',
      'inspect_reading',
      'propose_choice_plan',
      'request_plan_save',
    ])
  })
})
