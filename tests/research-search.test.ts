import { describe, expect, it } from 'vitest'
import { fetchPage } from '../scripts/research/fetch-page.mjs'
import { officialUrlAllowed, search } from '../scripts/research/search.mjs'
import { benchmarkById } from '../scripts/research/registry.mjs'
import { makeModel } from './fixtures/dataset'

const model = makeModel('kimi-k3', { name: 'Kimi K3', canonicalId: 'moonshotai/kimi-k3' })
const benchmark = benchmarkById('gpqa-diamond')

function response({ url = 'https://example.test/page', status = 200, contentType = 'text/html', text = '', length } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: {
      get(name) {
        if (name.toLowerCase() === 'content-type') return contentType
        if (name.toLowerCase() === 'content-length') return length
        return null
      },
    },
    text: async () => text,
  }
}

describe('safe search and fetch', () => {
  it('parses DuckDuckGo results and ranks official hosts first', async () => {
    const html = `
      <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fblog">Blog</a>
      <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgithub.com%2FMoonshotAI%2FKimi-K3">Kimi K3</a>
    `
    const results = await search({
      model,
      benchmark,
      fetchImpl: async () => response({ text: html }),
    })
    expect(results[0].url).toContain('github.com/MoonshotAI')
  })

  it('blocks SSRF redirects', async () => {
    const page = await fetchPage('https://example.test/redirect', {
      fetchImpl: async () => response({ url: 'http://127.0.0.1:4000/admin' }),
    })
    expect(page).toBeNull()
  })

  it('rejects oversized and non-html responses', async () => {
    expect(await fetchPage('https://example.test/big', {
      fetchImpl: async () => response({ length: '3000000' }),
    })).toBeNull()
    expect(await fetchPage('https://example.test/json', {
      fetchImpl: async () => response({ contentType: 'application/json' }),
    })).toBeNull()
  })

  it('excludes AA as evidence', () => {
    expect(officialUrlAllowed('https://artificialanalysis.ai/models/kimi-k3', 'moonshotai/kimi-k3')).toBe(false)
  })
})
