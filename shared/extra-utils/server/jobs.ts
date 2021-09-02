
import { JobState } from '../../models'
import { wait } from '../miscs'
import { PeerTubeServer } from './server'

async function waitJobs (serversArg: PeerTubeServer[] | PeerTubeServer, skipDelayed = false) {
  const pendingJobWait = process.env.NODE_PENDING_JOB_WAIT
    ? parseInt(process.env.NODE_PENDING_JOB_WAIT, 10)
    : 250

  let servers: PeerTubeServer[]

  if (Array.isArray(serversArg) === false) servers = [ serversArg as PeerTubeServer ]
  else servers = serversArg as PeerTubeServer[]

  const states: JobState[] = [ 'waiting', 'active' ]
  if (!skipDelayed) states.push('delayed')

  const repeatableJobs = [ 'videos-views', 'activitypub-cleaner' ]
  let pendingRequests: boolean

  function tasksBuilder () {
    const tasks: Promise<any>[] = []

    // Check if each server has pending request
    for (const server of servers) {
      for (const state of states) {
        const p = server.jobs.list({
          state,
          start: 0,
          count: 10,
          sort: '-createdAt'
        }).then(body => body.data)
          .then(jobs => jobs.filter(j => !repeatableJobs.includes(j.type)))
          .then(jobs => {
            if (jobs.length !== 0) {
              pendingRequests = true
            }
          })

        tasks.push(p)
      }

      const p = server.debug.getDebug()
        .then(obj => {
          if (obj.activityPubMessagesWaiting !== 0) {
            pendingRequests = true
          }
        })

      tasks.push(p)
    }

    return tasks
  }

  do {
    pendingRequests = false
    await Promise.all(tasksBuilder())

    // Retry, in case of new jobs were created
    if (pendingRequests === false) {
      await wait(pendingJobWait)
      await Promise.all(tasksBuilder())
    }

    if (pendingRequests) {
      await wait(pendingJobWait)
    }
  } while (pendingRequests)
}

// ---------------------------------------------------------------------------

export {
  waitJobs
}
