import { AllowNull, Column, CreatedAt, DataType, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { throwIfNotValid } from '../utils'
import {
  isPluginDescriptionValid,
  isPluginNameValid,
  isPluginTypeValid,
  isPluginVersionValid
} from '../../helpers/custom-validators/plugins'

@Table({
  tableName: 'plugin',
  indexes: [
    {
      fields: [ 'name' ],
      unique: true
    }
  ]
})
export class PluginModel extends Model<PluginModel> {

  @AllowNull(false)
  @Is('PluginName', value => throwIfNotValid(value, isPluginNameValid, 'name'))
  @Column
  name: string

  @AllowNull(false)
  @Is('PluginType', value => throwIfNotValid(value, isPluginTypeValid, 'type'))
  @Column
  type: number

  @AllowNull(false)
  @Is('PluginVersion', value => throwIfNotValid(value, isPluginVersionValid, 'version'))
  @Column
  version: string

  @AllowNull(false)
  @Column
  enabled: boolean

  @AllowNull(false)
  @Column
  uninstalled: boolean

  @AllowNull(false)
  @Is('PluginPeertubeEngine', value => throwIfNotValid(value, isPluginVersionValid, 'peertubeEngine'))
  @Column
  peertubeEngine: string

  @AllowNull(true)
  @Is('PluginDescription', value => throwIfNotValid(value, isPluginDescriptionValid, 'description'))
  @Column
  description: string

  @AllowNull(true)
  @Column(DataType.JSONB)
  settings: any

  @AllowNull(true)
  @Column(DataType.JSONB)
  storage: any

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  static listEnabledPluginsAndThemes () {
    const query = {
      where: {
        enabled: true,
        uninstalled: false
      }
    }

    return PluginModel.findAll(query)
  }

}
