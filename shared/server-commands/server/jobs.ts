
import { expect } from 'chai'
import { wait } from '@shared/core-utils'
import { JobState, JobType, RunnerJobState } from '../../models'
import { PeerTubeServer } from './server'

async function waitJobs (
  serversArg: PeerTubeServer[] | PeerTubeServer,
  options: {
    skipDelayed?: boolean // default false
    runnerJobs?: boolean // default false
  } = {}
) {
  const { skipDelayed = false, runnerJobs = false } = options

  const pendingJobWait = process.env.NODE_PENDING_JOB_WAIT
    ? parseInt(process.env.NODE_PENDING_JOB_WAIT, 10)
    : 250

  let servers: PeerTubeServer[]

  if (Array.isArray(serversArg) === false) servers = [ serversArg as PeerTubeServer ]
  else servers = serversArg as PeerTubeServer[]

  const states: JobState[] = [ 'waiting', 'active' ]
  if (!skipDelayed) states.push('delayed')

  const repeatableJobs: JobType[] = [ 'videos-views-stats', 'activitypub-cleaner' ]
  let pendingRequests: boolean

  function tasksBuilder () {
    const tasks: Promise<any>[] = []

    // Check if each server has pending request
    for (const server of servers) {
      if (process.env.DEBUG) console.log('Checking ' + server.url)

      for (const state of states) {

        const jobPromise = server.jobs.list({
          state,
          start: 0,
          count: 10,
          sort: '-createdAt'
        }).then(body => body.data)
          .then(jobs => jobs.filter(j => !repeatableJobs.includes(j.type)))
          .then(jobs => {
            if (jobs.length !== 0) {
              pendingRequests = true

              if (process.env.DEBUG) {
                console.log(jobs)
              }
            }
          })

        tasks.push(jobPromise)
      }

      const debugPromise = server.debug.getDebug()
        .then(obj => {
          if (obj.activityPubMessagesWaiting !== 0) {
            pendingRequests = true

            if (process.env.DEBUG) {
              console.log('AP messages waiting: ' + obj.activityPubMessagesWaiting)
            }
          }
        })
      tasks.push(debugPromise)

      if (runnerJobs) {
        const runnerJobsPromise = server.runnerJobs.list({ count: 100 })
          .then(({ data }) => {
            for (const job of data) {
              if (job.state.id !== RunnerJobState.COMPLETED) {
                pendingRequests = true

                if (process.env.DEBUG) {
                  console.log(job)
                }
              }
            }
          })
        tasks.push(runnerJobsPromise)
      }
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

async function expectNoFailedTranscodingJob (server: PeerTubeServer) {
  const { data } = await server.jobs.listFailed({ jobType: 'video-transcoding' })
  expect(data).to.have.lengthOf(0)
}

// ---------------------------------------------------------------------------

export {
  waitJobs,
  expectNoFailedTranscodingJob
}
