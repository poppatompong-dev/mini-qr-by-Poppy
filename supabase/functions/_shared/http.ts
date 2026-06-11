import { corsHeaders } from './cors.ts'

export interface FunctionErrorBody {
  ok: false
  error: {
    code: string
    message: string
  }
}

export interface FunctionSuccessBody<T> {
  ok: true
  data: T
}

export function jsonSuccess<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data } satisfies FunctionSuccessBody<T>), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

export function jsonError(code: string, message: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message } } satisfies FunctionErrorBody), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
