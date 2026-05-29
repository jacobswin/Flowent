import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { buildScenarioDraftPrompt } from './scenarioDraftPrompt'
import { claudeScenarioDraftSchema, type ClaudeScenarioDraft, type ScenarioDraftRequest } from './scenarioDraftSchemas'

export interface ScenarioDraftGeneratorDependencies {
  anthropic: {
    messages: {
      parse: (params: {
        model: string
        max_tokens: number
        thinking: { type: 'adaptive' }
        system: ReturnType<typeof buildScenarioDraftPrompt>['system']
        messages: ReturnType<typeof buildScenarioDraftPrompt>['messages']
        output_config: {
          effort: 'high'
          format: ReturnType<typeof zodOutputFormat>
        }
      }) => Promise<{ parsed_output: ClaudeScenarioDraft | null }>
    }
  }
}

export type ScenarioDraftGenerationErrorCode =
  | 'authentication'
  | 'rate-limited'
  | 'overloaded'
  | 'malformed-output'
  | 'api-error'

export class ScenarioDraftGenerationError extends Error {
  constructor(
    public readonly code: ScenarioDraftGenerationErrorCode,
    public readonly userMessage: string,
  ) {
    super(userMessage)
  }
}

export async function generateScenarioDraftWithClaude(
  input: ScenarioDraftRequest,
  dependencies: ScenarioDraftGeneratorDependencies,
): Promise<ClaudeScenarioDraft> {
  const prompt = buildScenarioDraftPrompt(input)

  try {
    const response = await dependencies.anthropic.messages.parse({
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: prompt.system,
      messages: prompt.messages,
      output_config: {
        effort: 'high',
        format: zodOutputFormat(claudeScenarioDraftSchema),
      },
    })

    if (!response.parsed_output) {
      throw new ScenarioDraftGenerationError(
        'malformed-output',
        'Flowent could not safely read the generated draft. Please try again.',
      )
    }

    return response.parsed_output
  } catch (error: unknown) {
    if (error instanceof ScenarioDraftGenerationError) {
      throw error
    }

    throw createScenarioDraftGenerationError(error)
  }
}

export function createScenarioDraftGenerationError(error: unknown): ScenarioDraftGenerationError {
  if (error instanceof Anthropic.AuthenticationError) {
    return new ScenarioDraftGenerationError(
      'authentication',
      'LLM draft generation is not configured for this environment.',
    )
  }

  if (error instanceof Anthropic.RateLimitError) {
    return new ScenarioDraftGenerationError(
      'rate-limited',
      'Claude is receiving too many requests right now. Please retry shortly.',
    )
  }

  if (error instanceof Anthropic.APIError && error.status === 529) {
    return new ScenarioDraftGenerationError(
      'overloaded',
      'Claude is temporarily overloaded. Please retry shortly.',
    )
  }

  if (error instanceof Anthropic.APIError) {
    return new ScenarioDraftGenerationError(
      'api-error',
      'Flowent could not generate a draft map right now. Please try again.',
    )
  }

  return new ScenarioDraftGenerationError(
    'api-error',
    'Flowent could not generate a draft map right now. Please try again.',
  )
}
