export interface BlockStatus {
  accounts: {
    [handle: string]: {
      blockedByServer: boolean
      blockedByServerSubscription: string | null

      blockedByUser: boolean
    }
  }

  hosts: {
    [host: string]: {
      blockedByServer: boolean
      blockedByServerSubscription: string | null

      blockedByUser: boolean
    }
  }
}
