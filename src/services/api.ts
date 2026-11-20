export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...init?.headers },
    ...init,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const body = (await response.json().catch(() => undefined)) as T | ApiErrorBody | undefined

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | undefined
    throw new ApiError(
      errorBody?.error?.message ?? `Request to ${path} failed with status ${response.status}.`,
      errorBody?.error?.code ?? 'unknown_error',
      response.status,
    )
  }

  return body as T
}
