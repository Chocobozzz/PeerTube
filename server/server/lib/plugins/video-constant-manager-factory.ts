import { ConstantManager } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import {
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_PLAYLIST_PRIVACIES,
  VIDEO_PRIVACIES
} from '@server/initializers/constants.js'

type AlterableVideoConstant = 'language' | 'licence' | 'category' | 'privacy' | 'playlistPrivacy'
type VideoConstant = Record<number | string, string>

type UpdatedVideoConstant = {
  [name in AlterableVideoConstant]: {
    [ npmName: string]: {
      added: VideoConstant[]
      deleted: VideoConstant[]
    }
  }
}

const constantsHash: { [key in AlterableVideoConstant]: VideoConstant } = {
  language: VIDEO_LANGUAGES,
  licence: VIDEO_LICENCES,
  category: VIDEO_CATEGORIES,
  privacy: VIDEO_PRIVACIES,
  playlistPrivacy: VIDEO_PLAYLIST_PRIVACIES
}

export class VideoConstantManagerFactory {
  private readonly updatedVideoConstants: UpdatedVideoConstant = {
    playlistPrivacy: { },
    privacy: { },
    language: { },
    licence: { },
    category: { }
  }

  constructor (
    private readonly npmName: string
  ) {}

  public resetVideoConstants (npmName: string) {
    const types: AlterableVideoConstant[] = [ 'language', 'licence', 'category', 'privacy', 'playlistPrivacy' ]
    for (const type of types) {
      this.resetConstants({ npmName, type })
    }
  }

  private resetConstants (parameters: { npmName: string, type: AlterableVideoConstant }) {
    const { npmName, type } = parameters
    const updatedConstants = this.updatedVideoConstants[type][npmName]

    if (!updatedConstants) return

    for (const added of updatedConstants.added) {
      delete constantsHash[type][added.key]
    }

    for (const deleted of updatedConstants.deleted) {
      constantsHash[type][deleted.key] = deleted.label
    }

    delete this.updatedVideoConstants[type][npmName]
  }

  public createVideoConstantManager<K extends number | string>(type: AlterableVideoConstant): ConstantManager<K> {
    const { npmName } = this
    return {
      addConstant: (key: K, label: string) => this.addConstant({ npmName, type, key, label }),
      deleteConstant: (key: K) => this.deleteConstant({ npmName, type, key }),
      getConstantValue: (key: K) => constantsHash[type][key],
      getConstants: () => constantsHash[type] as Record<K, string>,
      resetConstants: () => this.resetConstants({ npmName, type })
    }
  }

  private addConstant<T extends string | number> (parameters: {
    npmName: string
    type: AlterableVideoConstant
    key: T
    label: string
  }) {
    const { npmName, type, key, label } = parameters
    const obj = constantsHash[type]

    if (obj[key]) {
      logger.warn('Cannot add %s %s by plugin %s: key already exists.', type, npmName, key)
      return false
    }

    if (!this.updatedVideoConstants[type][npmName]) {
      this.updatedVideoConstants[type][npmName] = {
        added: [],
        deleted: []
      }
    }

    this.updatedVideoConstants[type][npmName].added.push({ key, label } as VideoConstant)
    obj[key] = label

    return true
  }

  private deleteConstant<T extends string | number> (parameters: {
    npmName: string
    type: AlterableVideoConstant
    key: T
  }) {
    const { npmName, type, key } = parameters
    const obj = constantsHash[type]

    if (!obj[key]) {
      logger.warn('Cannot delete %s by plugin %s: key %s does not exist.', type, npmName, key)
      return false
    }

    if (!this.updatedVideoConstants[type][npmName]) {
      this.updatedVideoConstants[type][npmName] = {
        added: [],
        deleted: []
      }
    }

    const updatedConstants = this.updatedVideoConstants[type][npmName]

    const alreadyAdded = updatedConstants.added.find(a => a.key === key)
    if (alreadyAdded) {
      updatedConstants.added.filter(a => a.key !== key)
    } else if (obj[key]) {
      updatedConstants.deleted.push({ key, label: obj[key] } as VideoConstant)
    }

    delete obj[key]

    return true
  }
}
