export type IPCResponse <T extends IPCResponseData = undefined> = {
  success: boolean
  error?: string
  data?: T
}

export type IPCResponseData =
  // list registered
  {
    servers: {
      runnerName: string
      runnerDescription: string
      url: string
    }[]
  }
