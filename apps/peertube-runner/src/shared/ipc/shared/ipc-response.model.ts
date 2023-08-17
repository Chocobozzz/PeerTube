export type IPCReponse <T extends IPCReponseData = undefined> = {
  success: boolean
  error?: string
  data?: T
}

export type IPCReponseData =
  // list registered
  {
    servers: {
      runnerName: string
      runnerDescription: string
      url: string
    }[]
  }
