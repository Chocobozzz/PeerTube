import { RunnerJob } from '@peertube/peertube-models'

export type IPCResponse <T extends IPCResponseData = undefined> = {
  success: boolean
  error?: string
  data?: T
}

export type IPCResponseData = IPCResponseListRegistered | IPCResponseListJobs

export type IPCResponseListRegistered = {
  servers: {
    runnerName: string
    runnerDescription: string
    url: string
  }[]
}
export type IPCResponseListJobs = {
  concurrency: number
  processingJobs: {
    serverUrl: string
    job: Pick<RunnerJob, 'type' | 'startedAt' | 'progress' | 'payload'>
  }[]
}
