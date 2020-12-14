import * as request from 'supertest'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import { makeGetRequest } from '../../../shared/extra-utils'
import { Job, JobState, JobType } from '../../models'
import { wait } from '../miscs/miscs'
import { ServerInfo } from './servers'

function buildJobsUrl (state?: JobState) {
  let path = '/api/v1/jobs'

  if (state) path += '/' + state

  return path
}

function getJobsList (url: string, accessToken: string, state?: JobState) {
  const path = buildJobsUrl(state)

  return request(url)
    .get(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(HttpStatusCode.OK_200)
    .expect('Content-Type', /json/)
}

function getJobsListPaginationAndSort (options: {
  url: string
  accessToken: string
  start: number
  count: number
  sort: string
  state?: JobState
  jobType?: JobType
}) {
  const { url, accessToken, state, start, count, sort, jobType } = options
  const path = buildJobsUrl(state)

  const query = {
    start,
    count,
    sort,
    jobType
  }

  return makeGetRequest({
    url,
    path,
    token: accessToken,
    statusCodeExpected: HttpStatusCode.OK_200,
    query
  })
}

async function waitJobs (serversArg: ServerInfo[] | ServerInfo) {
  const pendingJobWait = process.env.NODE_PENDING_JOB_WAIT ? parseInt(process.env.NODE_PENDING_JOB_WAIT, 10) : 2000
  let servers: ServerInfo[]

  if (Array.isArray(serversArg) === false) servers = [ serversArg as ServerInfo ]
  else servers = serversArg as ServerInfo[]

  const states: JobState[] = [ 'waiting', 'active', 'delayed' ]
  let pendingRequests: boolean

  function tasksBuilder () {
    const tasks: Promise<any>[] = []

    // Check if each server has pending request
    for (const server of servers) {
      for (const state of states) {
        const p = getJobsListPaginationAndSort({
          url: server.url,
          accessToken: server.accessToken,
          state: state,
          start: 0,
          count: 10,
          sort: '-createdAt'
        })
          .then(res => res.body.data)
          .then((jobs: Job[]) => jobs.filter(j => j.type !== 'videos-views'))
          .then(jobs => {
            if (jobs.length !== 0) {
              pendingRequests = true
            }
          })
        tasks.push(p)
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
      await wait(1000)
    }
  } while (pendingRequests)
}

// ---------------------------------------------------------------------------

export {
  getJobsList,
  waitJobs,
  getJobsListPaginationAndSort
}
