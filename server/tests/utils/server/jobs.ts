import * as request from 'supertest'
import { JobState } from '../../../../shared/models'
import { ServerInfo, wait } from '../index'

function getJobsList (url: string, accessToken: string, state: JobState) {
  const path = '/api/v1/jobs/' + state

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(200)
          .expect('Content-Type', /json/)
}

function getJobsListPaginationAndSort (url: string, accessToken: string, state: JobState, start: number, count: number, sort: string) {
  const path = '/api/v1/jobs/' + state

  return request(url)
          .get(path)
          .query({ start })
          .query({ count })
          .query({ sort })
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(200)
          .expect('Content-Type', /json/)
}

async function waitJobs (serversArg: ServerInfo[] | ServerInfo) {
  let servers: ServerInfo[]

  if (Array.isArray(serversArg) === false) servers = [ serversArg as ServerInfo ]
  else servers = serversArg as ServerInfo[]

  const states: JobState[] = [ 'waiting', 'active', 'delayed' ]
  const tasks: Promise<any>[] = []
  let pendingRequests: boolean

  do {
    pendingRequests = false

    // Check if each server has pending request
    for (const server of servers) {
      for (const state of states) {
        const p = getJobsListPaginationAndSort(server.url, server.accessToken, state, 0, 10, '-createdAt')
          .then(res => {
            if (res.body.total > 0) pendingRequests = true
          })
        tasks.push(p)
      }
    }

    await Promise.all(tasks)

    // Retry, in case of new jobs were created
    if (pendingRequests === false) {
      await wait(1000)

      await Promise.all(tasks)
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
