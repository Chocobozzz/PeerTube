export type IPCRequest =
  IPCRequestRegister |
  IPCRequestUnregister |
  IPCRequestListRegistered |
  IPCRequestGracefulShutdown

export type IPCRequestRegister = {
  type: 'register'
  url: string
  registrationToken: string
  runnerName: string
  runnerDescription?: string
}

export type IPCRequestUnregister = { type: 'unregister', url: string, runnerName: string }
export type IPCRequestListRegistered = { type: 'list-registered' }

export type IPCRequestGracefulShutdown = { type: 'graceful-shutdown' }
