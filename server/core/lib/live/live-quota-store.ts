class LiveQuotaStore {

  private static instance: LiveQuotaStore

  private readonly livesPerUser = new Map<number, { sessionId: string, size: number }[]>()

  private constructor () {
  }

  addNewLive (userId: number, sessionId: string) {
    if (!this.livesPerUser.has(userId)) {
      this.livesPerUser.set(userId, [])
    }

    const currentUserLive = { sessionId, size: 0 }
    const livesOfUser = this.livesPerUser.get(userId)
    livesOfUser.push(currentUserLive)
  }

  removeLive (userId: number, sessionId: string) {
    const newLivesPerUser = this.livesPerUser.get(userId)
                                             .filter(o => o.sessionId !== sessionId)

    this.livesPerUser.set(userId, newLivesPerUser)
  }

  addQuotaTo (userId: number, sessionId: string, size: number) {
    const lives = this.livesPerUser.get(userId)
    const live = lives.find(l => l.sessionId === sessionId)

    live.size += size
  }

  getLiveQuotaOfUser (userId: number) {
    const currentLives = this.livesPerUser.get(userId)
    if (!currentLives) return 0

    return currentLives.reduce((sum, obj) => sum + obj.size, 0)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

export {
  LiveQuotaStore
}
