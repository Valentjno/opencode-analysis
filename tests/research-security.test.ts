import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('research CI security', () => {
  it('contains no secret placeholders with real-looking values', async () => {
    for (const file of ['package.json', 'README.md', '.env.example', 'public/data/latest.json']) {
      const text = await readFile(file, 'utf8')
      expect(text).not.toMatch(/gsk_[A-Za-z0-9]{20,}/)
      expect(text).not.toMatch(/AIza[A-Za-z0-9_-]{30,}/)
    }
  })

  it('pins the router commit and catalog checksum', async () => {
    const workflow = await readFile('.github/workflows/research.yml', 'utf8')
    expect(workflow).toContain('85864c4d0f29b74db442b296087862b96f4d84a1')
    expect(workflow).toMatch(/sha256|checksum/i)
    expect(workflow).not.toContain('pull_request')
    expect(workflow.indexOf('git pull --rebase')).toBeLessThan(workflow.indexOf('git add public/data/research.json'))
    expect(workflow).toMatch(/"google-ai-studio"\s*:\s*\{[^}]*"enabled"\s*:\s*false/)
    expect(workflow).toContain('KILO_API_KEY')
    expect(workflow).toContain('REQUESTY_API_KEY')
    expect(workflow).toContain('CLOUDFLARE_API_TOKEN')
    expect(workflow).toContain('CLOUDFLARE_ACCOUNT_ID')
    const refresh = await readFile('.github/workflows/refresh.yml', 'utf8')
    expect(refresh).toContain('group: data-write')
  })
})
