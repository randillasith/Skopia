/**
 * The HTTP seam between this UI and the Skopia API.
 *
 * Everything the advertising screens know about the network lives here: one
 * request helper, one error type, and one place that decides how a failure is
 * described to a person. Screens deal in data and `ApiError`, never in `fetch`.
 */

/**
 * A request that reached the server and came back refused.
 *
 * `fields` is what the API returns for a form that is not complete yet — a map of
 * input name to message — so a screen can put each message under the input that
 * caused it rather than dropping one banner at the top of the page.
 */
export class ApiError extends Error {
  readonly status: number
  readonly fields: Record<string, string>

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }

  /** True when the caller is not allowed here, as opposed to being wrong. */
  get isDenied() {
    return this.status === 401 || this.status === 403
  }
}

/** The header every advertising endpoint identifies its caller by. */
const ACTOR_HEADER = 'X-User-Id'

type Options = {
  method?: string
  body?: unknown
  /** The signed-in account's numeric id. Omitted for the viewer-facing calls. */
  actorId?: number | null
  signal?: AbortSignal
}

/**
 * Make a request and return its parsed body.
 *
 * A network failure and a refusal both surface as `ApiError`, because from a
 * screen's point of view they are the same event — something to say out loud
 * rather than something to crash on. The two are told apart by `status`, which is
 * 0 when the request never arrived.
 */
export async function request<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.actorId != null) headers[ACTOR_HEADER] = String(options.actorId)

  let response: Response
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (cause) {
    // An aborted request is the caller changing its mind, not a failure, and
    // must not be reported to the person as one.
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError(0, 'Could not reach Skopia. Check that the API is running.')
  }

  if (!response.ok) {
    throw await toError(response)
  }
  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** Upload a file. Separate from `request` because it must not set Content-Type. */
export async function upload<T>(path: string, file: File, actorId: number | null): Promise<T> {
  const form = new FormData()
  form.append('file', file)

  const headers: Record<string, string> = {}
  if (actorId != null) headers[ACTOR_HEADER] = String(actorId)

  let response: Response
  try {
    // Deliberately no Content-Type: the browser sets it, and must, because only
    // it knows the multipart boundary it generated.
    response = await fetch(path, { method: 'POST', headers, body: form })
  } catch {
    throw new ApiError(0, 'Could not reach Skopia. Check that the API is running.')
  }

  if (!response.ok) throw await toError(response)
  return (await response.json()) as T
}

/**
 * Post a form the caller has assembled, for endpoints that take several files
 * and fields at once. Like `upload`, it must not set Content-Type: only the
 * browser knows the multipart boundary it generated.
 */
export async function submitForm<T>(
  path: string,
  form: FormData,
  actorId: number | null,
  method = 'POST',
): Promise<T> {
  const headers: Record<string, string> = {}
  if (actorId != null) headers[ACTOR_HEADER] = String(actorId)

  let response: Response
  try {
    response = await fetch(path, { method, headers, body: form })
  } catch {
    throw new ApiError(0, 'Could not reach Skopia. Check that the API is running.')
  }

  if (!response.ok) throw await toError(response)
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/**
 * Turn a failed response into an `ApiError`.
 *
 * The API answers with a JSON body carrying a human-readable message, but a
 * proxy, a crash or an HTML error page will not — so a body that cannot be parsed
 * falls back to something that still tells the reader what happened.
 */
async function toError(response: Response): Promise<ApiError> {
  let message = ''
  let fields: Record<string, string> = {}

  try {
    const body = await response.json()
    if (typeof body?.message === 'string') message = body.message
    if (body?.fields && typeof body.fields === 'object') fields = body.fields
  } catch {
    // Left empty on purpose; the fallback below is more useful than a parse error.
  }

  if (!message) {
    message =
      response.status === 401 ? 'Sign in to continue.'
      : response.status === 403 ? 'This account is not allowed to do that.'
      : response.status === 404 ? 'That no longer exists.'
      : `The request failed (${response.status}).`
  }
  return new ApiError(response.status, message, fields)
}
