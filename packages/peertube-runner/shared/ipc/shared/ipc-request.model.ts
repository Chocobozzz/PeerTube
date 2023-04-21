export type IPCRequest =
  IPCRequestRegister |
  IPCRequestUnregister |
  IPCRequestListRegistered

export type IPCRequestRegister = {
  type: 'register'
  url: string
  registrationToken: string
  runnerName: string
  runnerDescription?: string
}

export type IPCRequestUnregister = { type: 'unregister', url: string }
export type IPCRequestListRegistered = { type: 'list-registered' }
