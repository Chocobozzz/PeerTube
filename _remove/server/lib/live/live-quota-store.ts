class LiveQuotaStore {

  private static instance: LiveQuotaStore

  private readonly livesPerUser = new Map<number, { liveId: number, size: number }[]>()

  private constructor () {
  }

  addNewLive (userId: number, liveId: number) {
    if (!this.livesPerUser.has(userId)) {
      this.livesPerUser.set(userId, [])
    }

    const currentUserLive = { liveId, size: 0 }
    const livesOfUser = this.livesPerUser.get(userId)
    livesOfUser.push(currentUserLive)
  }

  removeLive (userId: number, liveId: number) {
    const newLivesPerUser = this.livesPerUser.get(userId)
                                             .filter(o => o.liveId !== liveId)

    this.livesPerUser.set(userId, newLivesPerUser)
  }

  addQuotaTo (userId: number, liveId: number, size: number) {
    const lives = this.livesPerUser.get(userId)
    const live = lives.find(l => l.liveId === liveId)

    live.size += size
  }

  getLiveQuotaOf (userId: number) {
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
