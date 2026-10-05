import { VideoLifecycleAction } from '@peertube/peertube-models'
import { MVideoFull } from '@server/types/models/index.js'

export interface LifecycleActionResult {
  // Number of files the action acted on
  files: number
}

export interface LifecycleActionHandler<A extends VideoLifecycleAction> {
  // Throw a human readable error if the action of the admin configuration is invalid
  validate(action: A): void

  // Human readable description of the action, used in logs
  describe(action: A): string

  // Restrict the candidate videos to the ones the action would actually change
  buildWhereForUnprocessed(action: A): { sql: string, replacements: Record<string, any> }

  // What `apply` would do, without touching any file
  simulate(video: MVideoFull, action: A): LifecycleActionResult

  apply(video: MVideoFull, action: A): Promise<LifecycleActionResult>
}
