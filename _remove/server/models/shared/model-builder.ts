import { isPlainObject } from 'lodash'
import { Model as SequelizeModel, Sequelize } from 'sequelize'
import { logger } from '@server/helpers/logger'

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
        const { created, model: subModel } = this.createModel(value, key, keyPath + '.' + json.id + '.' + key)
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
      return undefined
    }

    // FIXME: typings
    const model = new (Model as any)(json)
    this.modelRegistry.set(registryKey, model)

    return { created: true, model }
  }

  private findModelBuilder (modelName: string) {
    return this.sequelize.modelManager.getModel(this.buildSequelizeModelName(modelName))
  }

  private buildSequelizeModelName (modelName: string) {
    if (modelName === 'Avatars') return 'ActorImageModel'
    if (modelName === 'ActorFollowing') return 'ActorModel'
    if (modelName === 'ActorFollower') return 'ActorModel'
    if (modelName === 'FlaggedAccount') return 'AccountModel'

    return modelName + 'Model'
  }

  private getModelRegistryKey (json: any, keyPath: string) {
    return keyPath + json.id
  }
}
