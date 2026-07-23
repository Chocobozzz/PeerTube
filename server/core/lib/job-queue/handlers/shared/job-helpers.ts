import { UnrecoverableError } from 'bullmq'

export function buildPromiseForAbortSignal (abortSignal?: AbortSignal) {
  return new Promise((_res, rej) => {
    if (abortSignal?.aborted) {
      return rej(new UnrecoverableError('Job has been canceled'))
    }

    abortSignal?.addEventListener('abort', () => {
      rej(new UnrecoverableError('Job has been canceled'))
    })
  })
}
