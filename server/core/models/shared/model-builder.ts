import { logger } from '@server/helpers/logger.js'
import isPlainObject from 'lodash-es/isPlainObject.js'
import { ModelStatic, Sequelize, Model as SequelizeModel } from 'sequelize'

/**
 *
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

export class ModelBuilder <T extends SequelizeModel> {
  private readonly modelRegistry = new Map<string, T>()

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

  private createModel (json: any, modelName: string, keyPath: string) {
    if (!json.id) return { created: false, model: null }

    const { created, model } = this.createOrFindModel(json, modelName, keyPath)

    for (const key of Object.keys(json)) {
      const value = json[key]
      if (!value) continue

      // Child model
      if (isPlainObject(value)) {
        const { created, model: subModel } = this.createModel(value, key, `${keyPath}.${json.id}.${key}`)
        if (!created || !subModel) continue

        const Model = this.findModelBuilder(modelName)
        const association = Model.associations[key]

        if (!association) {
          logger.error('Cannot find association %s of model %s', key, modelName, { associations: Object.keys(Model.associations) })
          continue
        }

        if (association.isMultiAssociation) {
          if (!Array.isArray(model[key])) model[key] = []

          model[key].push(subModel)
        } else {
          model[key] = subModel
        }
      }
    }

    return { created, model }
  }

  private createOrFindModel (json: any, modelName: string, keyPath: string) {
    const registryKey = this.getModelRegistryKey(json, keyPath)
    if (this.modelRegistry.has(registryKey)) {
      return {
        created: false,
        model: this.modelRegistry.get(registryKey)
      }
    }

    const Model = this.findModelBuilder(modelName)

    if (!Model) {
      logger.error(
        'Cannot build model %s that does not exist', this.buildSequelizeModelName(modelName),
        { existing: this.sequelize.modelManager.all.map(m => m.name) }
      )
      return { created: false, model: null }
    }

    const model = Model.build(json, { raw: true, isNewRecord: false })

    this.modelRegistry.set(registryKey, model)

    return { created: true, model }
  }

  private findModelBuilder (modelName: string) {
    return this.sequelize.modelManager.getModel(this.buildSequelizeModelName(modelName)) as ModelStatic<T>
  }

  private buildSequelizeModelName (modelName: string) {
    if (modelName === 'Avatars') return 'ActorImageModel'
    if (modelName === 'ActorFollowing') return 'ActorModel'
    if (modelName === 'ActorFollower') return 'ActorModel'
    if (modelName === 'FlaggedAccount') return 'AccountModel'
    if (modelName === 'CommentAutomaticTags') return 'CommentAutomaticTagModel'

    return modelName + 'Model'
  }

  private getModelRegistryKey (json: any, keyPath: string) {
    return keyPath + json.id
  }
}
