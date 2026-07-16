import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { addAiProvider, getDecryptedApiKey, listPublicAiProviders, updateAiProvider } from './aiProviderStore'
import { createEmptyLibrary } from '../library/libraryStore'

let dir: string
let keyFile: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'flowent-ai-provider-'))
  keyFile = join(dir, 'flowent-ai-master.key')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('aiProviderStore', () => {
  it('encrypts provider API keys and only exposes masked key metadata', async () => {
    const lib = createEmptyLibrary()

    const { next, provider } = await addAiProvider(lib, {
      name: 'Team OpenRouter',
      presetId: 'openrouter',
      protocol: 'openai-compatible',
      apiBaseUrl: 'https://openrouter.ai/api/v1',
      useFullUrl: false,
      model: 'openai/gpt-4.1',
      websiteUrl: 'https://openrouter.ai',
      notes: 'User owned account',
      apiKey: 'sk-test-secret-123456',
      isDefault: true,
    }, { masterKeyFile: keyFile })

    expect(existsSync(keyFile)).toBe(true)
    expect(JSON.stringify(next)).not.toContain('sk-test-secret-123456')

    const publicProviders = listPublicAiProviders(next)
    expect(publicProviders).toHaveLength(1)
    expect(publicProviders[0]).toMatchObject({
      id: provider.id,
      name: 'Team OpenRouter',
      hasApiKey: true,
      isDefault: true,
    })
    expect(publicProviders[0].maskedApiKey).toBe('sk-t...3456')

    await expect(getDecryptedApiKey(next, provider.id, { masterKeyFile: keyFile })).resolves.toBe('sk-test-secret-123456')
  })

  it('keeps the previous encrypted key when updating provider fields without a new apiKey', async () => {
    let lib = createEmptyLibrary()
    const created = await addAiProvider(lib, {
      name: 'DeepSeek',
      presetId: 'deepseek',
      protocol: 'openai-compatible',
      apiBaseUrl: 'https://api.deepseek.com/v1',
      useFullUrl: false,
      model: 'deepseek-chat',
      websiteUrl: '',
      notes: '',
      apiKey: 'sk-original-9999',
      isDefault: true,
    }, { masterKeyFile: keyFile })
    lib = created.next

    const updated = await updateAiProvider(lib, created.provider.id, { model: 'deepseek-reasoner' }, { masterKeyFile: keyFile })

    expect(listPublicAiProviders(updated.next)[0]).toMatchObject({
      model: 'deepseek-reasoner',
      maskedApiKey: 'sk-o...9999',
      hasApiKey: true,
    })
    await expect(getDecryptedApiKey(updated.next, created.provider.id, { masterKeyFile: keyFile })).resolves.toBe('sk-original-9999')
  })
})
