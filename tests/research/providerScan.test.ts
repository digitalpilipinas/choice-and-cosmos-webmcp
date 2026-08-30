import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FORBIDDEN =
  /GEMINI_API_KEY|QUOTA_HASH_SECRET|D1Database|createD1QuotaStore|callGeminiSearch/

function walk(dir: string): string[] {
  if (!existsSync(dir)) {
    return []
  }
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      out.push(...walk(full))
      continue
    }
    if (/\.(ts|tsx|js|mjs)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

describe('active product path provider scan', () => {
  it('keeps Gemini, D1, and quota symbols out of src and worker', () => {
    const root = process.cwd()
    const files = [...walk(join(root, 'src')), ...walk(join(root, 'worker'))]
    expect(files.length).toBeGreaterThan(0)
    for (const path of files) {
      const text = readFileSync(path, 'utf8')
      expect(text, path).not.toMatch(FORBIDDEN)
    }
  })
})
