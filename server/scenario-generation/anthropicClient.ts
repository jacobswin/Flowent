import Anthropic from '@anthropic-ai/sdk'

export function hasAnthropicApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

export function createAnthropicClient(): Anthropic {
  if (!hasAnthropicApiKey()) {
    throw new Error('Anthropic API key is not configured.')
  }

  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}
