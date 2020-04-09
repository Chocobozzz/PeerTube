import { PluginSettingsManager } from '@shared/models/plugins/plugin-settings-manager.model'
import { PluginModel } from '@server/models/server/plugin'
import { PluginStorageManager } from '@shared/models/plugins/plugin-storage-manager.model'
import { PluginVideoLanguageManager } from '@shared/models/plugins/plugin-video-language-manager.model'
import { VIDEO_CATEGORIES, VIDEO_LANGUAGES, VIDEO_LICENCES } from '@server/initializers/constants'
import { PluginVideoLicenceManager } from '@shared/models/plugins/plugin-video-licence-manager.model'
import { PluginVideoCategoryManager } from '@shared/models/plugins/plugin-video-category-manager.model'
import { RegisterServerOptions } from '@server/typings/plugins'
import { buildPluginHelpers } from './plugin-helpers'
import { logger } from '@server/helpers/logger'

type AlterableVideoConstant = 'language' | 'licence' | 'category'
type VideoConstant = { [key in number | string]: string }
type UpdatedVideoConstant = {
  [name in AlterableVideoConstant]: {
    [npmName: string]: {
      added: { key: number | string, label: string }[]
      deleted: { key: number | string, label: string }[]
    }
  }
}

const updatedVideoConstants: UpdatedVideoConstant = {
  language: {},
  licence: {},
  category: {}
}

function buildRegisterHelpers (npmName: string, plugin: PluginModel): Omit<RegisterServerOptions, 'registerHook' | 'registerSetting'> {
  const settingsManager = buildSettingsManager(plugin)
  const storageManager = buildStorageManager(plugin)

  const videoLanguageManager = buildVideoLanguageManager(npmName)

  const videoCategoryManager = buildVideoCategoryManager(npmName)
  const videoLicenceManager = buildVideoLicenceManager(npmName)

  const peertubeHelpers = buildPluginHelpers(npmName)

  return {
    settingsManager,
    storageManager,
    videoLanguageManager,
    videoCategoryManager,
    videoLicenceManager,
    peertubeHelpers
  }
}

function reinitVideoConstants (npmName: string) {
  const hash = {
    language: VIDEO_LANGUAGES,
    licence: VIDEO_LICENCES,
    category: VIDEO_CATEGORIES
  }
  const types: AlterableVideoConstant[] = [ 'language', 'licence', 'category' ]

  for (const type of types) {
    const updatedConstants = updatedVideoConstants[type][npmName]
    if (!updatedConstants) continue

    for (const added of updatedConstants.added) {
      delete hash[type][added.key]
    }

    for (const deleted of updatedConstants.deleted) {
      hash[type][deleted.key] = deleted.label
    }

    delete updatedVideoConstants[type][npmName]
  }
}

export {
  buildRegisterHelpers,
  reinitVideoConstants
}

// ---------------------------------------------------------------------------

function buildSettingsManager (plugin: PluginModel): PluginSettingsManager {
  return {
    getSetting: (name: string) => PluginModel.getSetting(plugin.name, plugin.type, name),

    setSetting: (name: string, value: string) => PluginModel.setSetting(plugin.name, plugin.type, name, value)
  }
}

function buildStorageManager (plugin: PluginModel): PluginStorageManager {
  return {
    getData: (key: string) => PluginModel.getData(plugin.name, plugin.type, key),

    storeData: (key: string, data: any) => PluginModel.storeData(plugin.name, plugin.type, key, data)
  }
}

function buildVideoLanguageManager (npmName: string): PluginVideoLanguageManager {
  return {
    addLanguage: (key: string, label: string) => addConstant({ npmName, type: 'language', obj: VIDEO_LANGUAGES, key, label }),

    deleteLanguage: (key: string) => deleteConstant({ npmName, type: 'language', obj: VIDEO_LANGUAGES, key })
  }
}

function buildVideoCategoryManager (npmName: string): PluginVideoCategoryManager {
  return {
    addCategory: (key: number, label: string) => {
      return addConstant({ npmName, type: 'category', obj: VIDEO_CATEGORIES, key, label })
    },

    deleteCategory: (key: number) => {
      return deleteConstant({ npmName, type: 'category', obj: VIDEO_CATEGORIES, key })
    }
  }
}

function buildVideoLicenceManager (npmName: string): PluginVideoLicenceManager {
  return {
    addLicence: (key: number, label: string) => {
      return addConstant({ npmName, type: 'licence', obj: VIDEO_LICENCES, key, label })
    },

    deleteLicence: (key: number) => {
      return deleteConstant({ npmName, type: 'licence', obj: VIDEO_LICENCES, key })
    }
  }
}

function addConstant<T extends string | number> (parameters: {
  npmName: string
  type: AlterableVideoConstant
  obj: VideoConstant
  key: T
  label: string
}) {
  const { npmName, type, obj, key, label } = parameters

  if (obj[key]) {
    logger.warn('Cannot add %s %s by plugin %s: key already exists.', type, npmName, key)
    return false
  }

  if (!updatedVideoConstants[type][npmName]) {
    updatedVideoConstants[type][npmName] = {
      added: [],
      deleted: []
    }
  }

  updatedVideoConstants[type][npmName].added.push({ key, label })
  obj[key] = label

  return true
}

function deleteConstant<T extends string | number> (parameters: {
  npmName: string
  type: AlterableVideoConstant
  obj: VideoConstant
  key: T
}) {
  const { npmName, type, obj, key } = parameters

  if (!obj[key]) {
    logger.warn('Cannot delete %s %s by plugin %s: key does not exist.', type, npmName, key)
    return false
  }

  if (!updatedVideoConstants[type][npmName]) {
    updatedVideoConstants[type][npmName] = {
      added: [],
      deleted: []
    }
  }

  updatedVideoConstants[type][npmName].deleted.push({ key, label: obj[key] })
  delete obj[key]

  return true
}
