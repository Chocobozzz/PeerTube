export type IPCRequest =
  IPCRequestRegister |
  IPCRequestUnregister |
  IPCRequestListRegistered |
  IPCRequestGracefulShutdown |
  IPCRequestListJobs

export type IPCRequestRegister = {
  type: 'register'
  url: string
  registrationToken: string
  runnerName: string
  runnerDescription?: string
}

export type IPCRequestUnregister = { type: 'unregister', url: string, runnerName: string }
export type IPCRequestListRegistered = { type: 'list-registered' }
export type IPCRequestListJobs = { type: 'list-jobs' }

export type IPCRequestGracefulShutdown = { type: 'graceful-shutdown' }
