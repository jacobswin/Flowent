import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import type { SavedLibrary } from '../library/libraryStore'

export type AiProviderProtocol = 'openai-compatible' | 'anthropic'

export type SavedAiProvider = SavedLibrary['aiSettings']['providers'][number]

export type PublicAiProvider = Omit<SavedAiProvider, 'encryptedApiKey'> & {
  hasApiKey: boolean
  maskedApiKey: string
}

export type AiProviderStoreOptions = {
  masterKeyFile: string
}

export type AiProviderInput = {
  name: string
  presetId: string
  protocol: AiProviderProtocol
  apiBaseUrl: string
  useFullUrl: boolean
  model: string
  websiteUrl?: string
  notes?: string
  apiKey?: string
  isDefault?: boolean
}

export type AiProviderPatch = Partial<Omit<AiProviderInput, 'apiKey'>> & {
  apiKey?: string
  clearApiKey?: boolean
}

export function listPublicAiProviders(lib: SavedLibrary): PublicAiProvider[] {
  return lib.aiSettings.providers.map(toPublicProvider)
}

export function findSavedAiProvider(lib: SavedLibrary, providerId: string | null | undefined): SavedAiProvider | null {
  if (providerId) {
    return lib.aiSettings.providers.find((provider) => provider.id === providerId) ?? null
  }
  const defaultProviderId = lib.aiSettings.defaultProviderId
  if (defaultProviderId) {
    return lib.aiSettings.providers.find((provider) => provider.id === defaultProviderId) ?? null
  }
  return lib.aiSettings.providers[0] ?? null
}

export async function addAiProvider(
  lib: SavedLibrary,
  input: AiProviderInput,
  options: AiProviderStoreOptions,
): Promise<{ next: SavedLibrary; provider: PublicAiProvider }> {
  const id = `provider-${randomUUID()}`
  const shouldBecomeDefault = input.isDefault === true || lib.aiSettings.providers.length === 0
  const provider: SavedAiProvider = {
    id,
    name: input.name.trim(),
    presetId: input.presetId,
    protocol: input.protocol,
    apiBaseUrl: input.apiBaseUrl.trim(),
    useFullUrl: input.useFullUrl,
    model: input.model.trim(),
    websiteUrl: input.websiteUrl?.trim() ?? '',
    notes: input.notes?.trim() ?? '',
    encryptedApiKey: input.apiKey?.trim()
      ? await encryptApiKey(input.apiKey.trim(), options)
      : undefined,
    isDefault: shouldBecomeDefault,
  }

  const providers = [
    ...lib.aiSettings.providers.map((existing) => ({
      ...existing,
      isDefault: shouldBecomeDefault ? false : existing.isDefault,
    })),
    provider,
  ]
  const next = normalizeAiSettings({
    ...lib,
    aiSettings: {
      providers,
      defaultProviderId: shouldBecomeDefault ? provider.id : lib.aiSettings.defaultProviderId,
    },
  })

  return { next, provider: toPublicProvider(next.aiSettings.providers.find((item) => item.id === id)!) }
}

export async function updateAiProvider(
  lib: SavedLibrary,
  providerId: string,
  patch: AiProviderPatch,
  options: AiProviderStoreOptions,
): Promise<{ next: SavedLibrary; provider: PublicAiProvider }> {
  const existing = lib.aiSettings.providers.find((provider) => provider.id === providerId)
  if (!existing) throw new Error('NOT_FOUND')

  const encryptedApiKey = patch.clearApiKey
    ? undefined
    : patch.apiKey?.trim()
      ? await encryptApiKey(patch.apiKey.trim(), options)
      : existing.encryptedApiKey
  const wantsDefault = patch.isDefault === true

  const providers = lib.aiSettings.providers.map((provider) => {
    if (provider.id !== providerId) {
      return wantsDefault ? { ...provider, isDefault: false } : provider
    }
    return {
      ...provider,
      name: patch.name !== undefined ? patch.name.trim() : provider.name,
      presetId: patch.presetId ?? provider.presetId,
      protocol: patch.protocol ?? provider.protocol,
      apiBaseUrl: patch.apiBaseUrl !== undefined ? patch.apiBaseUrl.trim() : provider.apiBaseUrl,
      useFullUrl: patch.useFullUrl ?? provider.useFullUrl,
      model: patch.model !== undefined ? patch.model.trim() : provider.model,
      websiteUrl: patch.websiteUrl !== undefined ? patch.websiteUrl.trim() : provider.websiteUrl,
      notes: patch.notes !== undefined ? patch.notes.trim() : provider.notes,
      encryptedApiKey,
      isDefault: wantsDefault ? true : patch.isDefault === false ? false : provider.isDefault,
    }
  })

  const next = normalizeAiSettings({
    ...lib,
    aiSettings: {
      providers,
      defaultProviderId: wantsDefault
        ? providerId
        : patch.isDefault === false && lib.aiSettings.defaultProviderId === providerId
          ? null
          : lib.aiSettings.defaultProviderId,
    },
  })
  const provider = next.aiSettings.providers.find((item) => item.id === providerId)!
  return { next, provider: toPublicProvider(provider) }
}

export function deleteAiProvider(lib: SavedLibrary, providerId: string): { next: SavedLibrary; deleted: boolean } {
  const providers = lib.aiSettings.providers.filter((provider) => provider.id !== providerId)
  if (providers.length === lib.aiSettings.providers.length) return { next: lib, deleted: false }

  const nextDefaultId = lib.aiSettings.defaultProviderId === providerId
    ? providers[0]?.id ?? null
    : lib.aiSettings.defaultProviderId
  return {
    next: normalizeAiSettings({
      ...lib,
      aiSettings: {
        providers: providers.map((provider) => ({ ...provider, isDefault: provider.id === nextDefaultId })),
        defaultProviderId: nextDefaultId,
      },
    }),
    deleted: true,
  }
}

export async function getDecryptedApiKey(
  lib: SavedLibrary,
  providerId: string,
  options: AiProviderStoreOptions,
): Promise<string | null> {
  const provider = lib.aiSettings.providers.find((item) => item.id === providerId)
  if (!provider?.encryptedApiKey) return null
  return decryptApiKey(provider.encryptedApiKey, options)
}

export async function encryptApiKey(apiKey: string, options: AiProviderStoreOptions): Promise<NonNullable<SavedAiProvider['encryptedApiKey']>> {
  const key = await readOrCreateMasterKey(options.masterKeyFile)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: authTag.toString('base64'),
    keyPreview: maskApiKey(apiKey),
  }
}

async function decryptApiKey(
  encrypted: NonNullable<SavedAiProvider['encryptedApiKey']>,
  options: AiProviderStoreOptions,
): Promise<string> {
  const key = await readOrCreateMasterKey(options.masterKeyFile)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

async function readOrCreateMasterKey(filePath: string): Promise<Buffer> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const decoded = Buffer.from(raw.trim(), 'base64')
    if (decoded.length === 32) return decoded
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const key = randomBytes(32)
  await fs.mkdir(dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, key.toString('base64'), { encoding: 'utf8', mode: 0o600 })
  return key
}

function normalizeAiSettings(lib: SavedLibrary): SavedLibrary {
  const defaultProviderId = lib.aiSettings.defaultProviderId
  const firstProviderId = lib.aiSettings.providers[0]?.id ?? null
  const resolvedDefaultId = defaultProviderId && lib.aiSettings.providers.some((provider) => provider.id === defaultProviderId)
    ? defaultProviderId
    : firstProviderId
  return {
    ...lib,
    aiSettings: {
      providers: lib.aiSettings.providers.map((provider) => ({
        ...provider,
        isDefault: provider.id === resolvedDefaultId,
      })),
      defaultProviderId: resolvedDefaultId,
    },
  }
}

function toPublicProvider(provider: SavedAiProvider): PublicAiProvider {
  const { encryptedApiKey, ...rest } = provider
  return {
    ...rest,
    hasApiKey: Boolean(encryptedApiKey),
    maskedApiKey: encryptedApiKey?.keyPreview ?? '',
  }
}

function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim()
  if (trimmed.length <= 8) return '****'
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`
}
