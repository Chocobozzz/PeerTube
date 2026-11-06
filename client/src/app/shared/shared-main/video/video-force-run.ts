import { ConfirmService } from '@app/core'
import { escapeHTML } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { PeerTubeReconnectError } from '@root-helpers/errors'
import { from, Observable, of, throwError } from 'rxjs'
import { catchError, concatMap, map, switchMap, toArray } from 'rxjs/operators'

type VideoForceRunFailure<V> = { video: V, status: 'failed', error: Error }

export type VideoForceRunOutcome<V, S extends string> =
  | { video: V, status: S | 'skipped' }
  | VideoForceRunFailure<V>

type VideoRunOutcome<V, S extends string> =
  | VideoForceRunOutcome<V, S>
  | { video: V, status: 'conflict' }

// Ask confirmation to users for videos that require forcing the action.
// Errors that would also fail on the next videos (reconnection required, server unavailable etc.) abort the whole batch
export function runOnVideosWithForceConfirm<V, S extends string> (options: {
  videos: V[]

  run: (video: V, force: boolean) => Observable<S | 'conflict'>

  confirmForce: (videos: V[]) => Promise<boolean>
}): Observable<VideoForceRunOutcome<V, S>[]> {
  const { videos, run, confirmForce } = options

  const runAll = (videos: V[], force: boolean) => {
    return from(videos).pipe(
      concatMap(video => {
        return run(video, force).pipe(
          map((status): VideoRunOutcome<V, S> => {
            if (status === 'conflict') return { video, status: 'conflict' }

            return { video, status }
          }),
          catchError((error: Error) => {
            if (isBatchAbortingError(error)) return throwError(() => error)

            return of<VideoRunOutcome<V, S>>({ video, status: 'failed', error })
          })
        )
      }),
      toArray(),
      map(outcomes => ({
        done: outcomes.filter(isNotConflict),
        conflicts: outcomes.filter(isConflict).map(o => o.video)
      }))
    )
  }

  const skipped = (videos: V[]) => videos.map(video => ({ video, status: 'skipped' as const }))

  return runAll(videos, false).pipe(
    switchMap(({ done, conflicts }) => {
      if (conflicts.length === 0) return of(done)

      return from(confirmForce(conflicts)).pipe(
        switchMap(confirmed => {
          if (!confirmed) return of([ ...done, ...skipped(conflicts) ])

          return runAll(conflicts, true).pipe(
            // Conflicts should not happen when forcing the action
            map(forced => [ ...done, ...forced.done, ...skipped(forced.conflicts) ])
          )
        })
      )
    })
  )
}

export function countVideoForceRunOutcomes<V, S extends string> (outcomes: VideoForceRunOutcome<V, S>[], status: S | 'skipped') {
  return outcomes.filter(o => o.status === status).length
}

export function getVideoForceRunFailures<V, S extends string> (outcomes: VideoForceRunOutcome<V, S>[]) {
  return outcomes
    .filter(isFailure)
    .map(({ video, error }) => ({ video, error }))
}

// ---------------------------------------------------------------------------

export function confirmVideosForce (options: {
  confirmService: ConfirmService
  videos: { name: string }[]

  // Used for the modal title and the confirm button
  action: string

  // Video name is HTML escaped
  singleVideoMessage: (name: string) => string
  multipleVideosMessage: (count: number) => string
}) {
  const { confirmService, videos, action, singleVideoMessage, multipleVideosMessage } = options

  const confirmOptions = { confirmButtonText: action, cancelButtonText: $localize`Skip` }

  if (videos.length === 1) {
    return confirmService.confirm(singleVideoMessage(escapeHTML(videos[0].name)), action, confirmOptions)
  }

  return confirmService.confirm(multipleVideosMessage(videos.length), action, {
    ...confirmOptions,

    moreInfo: { title: $localize`Videos`, content: videos.map(v => v.name).join('\n') }
  })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function isConflict<V, S extends string> (o: VideoRunOutcome<V, S>): o is { video: V, status: 'conflict' } {
  return o.status === 'conflict'
}

function isNotConflict<V, S extends string> (o: VideoRunOutcome<V, S>): o is VideoForceRunOutcome<V, S> {
  return o.status !== 'conflict'
}

function isFailure<V, S extends string> (o: VideoForceRunOutcome<V, S>): o is VideoForceRunFailure<V> {
  return o.status === 'failed'
}

function isBatchAbortingError (error: Error) {
  if (error instanceof PeerTubeReconnectError) return true

  const status = (error as { status?: number })?.status

  return status === 0 || // Network error
    status === HttpStatusCode.TOO_MANY_REQUESTS_429 ||
    status === HttpStatusCode.BAD_GATEWAY_502 ||
    status === HttpStatusCode.SERVICE_UNAVAILABLE_503 ||
    status === HttpStatusCode.GATEWAY_TIMEOUT_504
}
