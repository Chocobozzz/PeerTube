import { logger } from '@server/helpers/logger.js'
import isPlainObject from 'lodash-es/isPlainObject.js'
import { ModelStatic, Sequelize, Model as SequelizeModel } from 'sequelize'

/**
 * Build Sequelize models from sequelize raw query (that must use { nest: true } options)
 *
 * In order to sequelize to correctly build the JSON this class will ingest,
 * the columns selected in the raw query should be in the following form:
 *   * All tables must be Pascal Cased (for example "VideoChannel")
 *   * Root table must end with `Model` (for example "VideoCommentModel")
 *   * Joined tables must contain the origin table name + '->JoinedTable'. For example:
 *     * "Actor" is joined to "Account": "Actor" table must be renamed "Account->Actor"
 *     * "Account->Actor" is joined to "Server": "Server" table must be renamed to "Account->Actor->Server"
 *   * Selected columns must be renamed to contain the JSON path:
 *     * "videoComment"."id": "VideoCommentModel"."id"
 *     * "Account"."Actor"."Server"."id": "Account.Actor.Server.id"
 *   * All tables must contain the row id
 */

export class ModelBuilder<T extends SequelizeModel> {
  private readonly modelRegistry = new Map<string, T>()

  private readonly aliasToTableName = {
    ChannelCollab: 'VideoChannelCollaborator',
    Collabs: 'VideoChannelCollaborators'
  }

  private readonly tableNameToModelName = {
    Avatars: 'ActorImageModel',
    Banners: 'ActorImageModel',
    ActorFollowing: 'ActorModel',
    ActorFollower: 'ActorModel',
    FlaggedAccount: 'AccountModel',
    CommentAutomaticTags: 'CommentAutomaticTagModel',
    OwnerAccount: 'AccountModel',
    Thumbnails: 'ThumbnailModel',
    Channel: 'VideoChannelModel',
    VideoChannels: 'VideoChannelModel',
    VideoPlaylists: 'VideoPlaylistModel',
    NotificationSetting: 'UserNotificationSettingModel',
    VideoChannelCollaborators: 'VideoChannelCollaboratorModel',
    Tags: 'TagModel'
  }

  constructor (private readonly sequelize: Sequelize) {
  }

  createModels (jsonArray: any[], baseModelName: string): T[] {
    const result: T[] = []

    for (const json of jsonArray) {
      const { created, model } = this.createModel(json, baseModelName, json.id + '.' + baseModelName)

      if (created) result.push(model)
    }

    return result
  }

  private createModel (json: any, rootTableName: string, keyPath: string) {
    if (!json.id) return { created: false, model: null }

    const { created, model } = this.createOrFindModel(json, rootTableName, keyPath)

    for (const key of Object.keys(json)) {
      const value = json[key]
      if (!value) continue

      const tableName = this.buildTableName(key)

      // Child model
      if (isPlainObject(value)) {
        const Model = this.findModelBuilder(rootTableName)
        const association = Model.associations[tableName]

        if (!association) {
          if (!Model.getAttributes()[tableName]) {
            logger.error(`Cannot find association ${tableName} from key ${key} of model ${rootTableName}`, {
              associations: Object.keys(Model.associations),
              model: Model.getAttributes()
            })
          }

          continue
        }

        const { created, model: subModel } = this.createModel(value, tableName, `${keyPath}.${json.id}.${key}`)

        if (association.isMultiAssociation && !Array.isArray(model[tableName])) {
          model[tableName] = []
        }

        if (!created || !subModel) continue

        if (Array.isArray(model[tableName])) {
          model[tableName].push(subModel)
        } else {
          model[tableName] = subModel
        }
      }
    }

    return { created, model }
  }

  private createOrFindModel (json: any, tableName: string, keyPath: string) {
    const registryKey = this.getModelRegistryKey(json, keyPath)
    if (this.modelRegistry.has(registryKey)) {
      return {
        created: false,
        model: this.modelRegistry.get(registryKey)
      }
    }

    const Model = this.findModelBuilder(tableName)
    if (!Model) {
      throw new Error(`Cannot find model builder for ${tableName}. You may have to add an alias in ModelBuilder class`)
    }

    if (!Model) {
      logger.error(
        'Cannot build model %s that does not exist',
        this.buildSequelizeModelName(tableName),
        { existing: this.sequelize.modelManager.all.map(m => m.name) }
      )
      return { created: false, model: null }
    }

    const model = Model.build(json, { raw: true, isNewRecord: false })

    this.modelRegistry.set(registryKey, model)

    return { created: true, model }
  }

  private findModelBuilder (tableName: string) {
    return this.sequelize.modelManager.getModel(this.buildSequelizeModelName(tableName)) as ModelStatic<T>
  }

  private buildSequelizeModelName (tableNameArg: string) {
    const tableName = this.buildTableName(tableNameArg)

    return this.tableNameToModelName[tableName] ?? tableName + 'Model'
  }

  private buildTableName (tableName: string) {
    return this.aliasToTableName[tableName] ?? tableName
  }

  private getModelRegistryKey (json: any, keyPath: string) {
    return keyPath + json.id
  }
}
