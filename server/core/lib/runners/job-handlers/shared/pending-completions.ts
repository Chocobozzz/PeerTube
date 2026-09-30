// Completions of runner jobs running in this process: they can continue after the response of the success request
// A shutdown aborts the abortable ones to give the jobs back to the runners, unless they already made changes that cannot be undone

export type PendingCompletion = {
  runnerJobUUID: string

  // The job handler supports giving the job back to the runners during its completion, and calls commitPendingCompletion()
  abortable: boolean

  // The completion started changes that cannot be undone: giving the job back to the runners would process it twice
  committed: boolean

  // The job has been given back to the runners: the completion must not change anything anymore
  aborted: boolean
}

export class RunnerJobCompletionAbortedError extends Error {
  constructor (runnerJobUUID: string) {
    super(`Completion of runner job ${runnerJobUUID} has been aborted`)
  }
}

const pendingCompletions = new Map<string, PendingCompletion>()

export function registerPendingCompletion (runnerJobUUID: string, options: { abortable: boolean }) {
  const completion: PendingCompletion = { runnerJobUUID, abortable: options.abortable, committed: false, aborted: false }
  pendingCompletions.set(runnerJobUUID, completion)

  return completion
}

export function unregisterPendingCompletion (completion: PendingCompletion) {
  if (pendingCompletions.get(completion.runnerJobUUID) === completion) pendingCompletions.delete(completion.runnerJobUUID)
}

// Called by a shutdown: the abortable completions that did not commit are marked as aborted, so they cannot change anything anymore
// Synchronous, so no completion can commit while they are marked
// Returns the aborted completions, whose jobs must be given back to the runners, and the ones that cannot be aborted
export function abortPendingCompletions () {
  const aborted: PendingCompletion[] = []
  const notAborted: PendingCompletion[] = []

  for (const completion of pendingCompletions.values()) {
    if (!completion.abortable || completion.committed) {
      notAborted.push(completion)
      continue
    }

    completion.aborted = true
    aborted.push(completion)
  }

  return { aborted, notAborted }
}

// Called by an abortable completion before changes that cannot be undone, and by every completion before saving the final job state
// Throws if the job has been given back to the runners, so the completion rolls back what it did
export function commitPendingCompletion (runnerJobUUID: string) {
  const completion = pendingCompletions.get(runnerJobUUID)
  if (!completion) return

  if (completion.aborted) throw new RunnerJobCompletionAbortedError(runnerJobUUID)

  completion.committed = true
}
