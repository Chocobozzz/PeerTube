import { Activity, ActivityPubActor, ActivityPubOrderedCollection } from '@peertube/peertube-models'
import { Awaitable } from '@peertube/peertube-typescript-utils'
import { MUserDefault } from '@server/types/models/user/user.js'
import { Readable } from 'stream'

export type ExportResult <T> = {
  json: T[] | T

  staticFiles: {
    archivePath: string
    readStreamFactory: () => Promise<Readable>
  }[]

  activityPub?: ActivityPubActor | ActivityPubOrderedCollection<string>

  activityPubOutbox?: Omit<Activity, '@context'>[]
}

type ActivityPubFilenames = {
  likes: string
  dislikes: string
  outbox: string
  following: string
  account: string
}

export abstract class AbstractUserExporter <T> {
  protected user: MUserDefault

  protected activityPubFilenames: ActivityPubFilenames

  protected relativeStaticDirPath: string

  constructor (options: {
    user: MUserDefault

    activityPubFilenames: ActivityPubFilenames

    relativeStaticDirPath?: string
  }) {
    this.user = options.user
    this.activityPubFilenames = options.activityPubFilenames
    this.relativeStaticDirPath = options.relativeStaticDirPath
  }

  getActivityPubFilename () {
    return null
  }

  abstract export (): Awaitable<ExportResult<T>>
}
