import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { CustomPage } from '@shared/models'
import { ActorModel } from '../actor/actor'
import { getServerActor } from '../application/application'

@Table({
  tableName: 'actorCustomPage',
  indexes: [
    {
      fields: [ 'actorId', 'type' ],
      unique: true
    }
  ]
})
export class ActorCustomPageModel extends Model {

  @AllowNull(true)
  @Column(DataType.TEXT)
  content: string

  @AllowNull(false)
  @Column
  type: 'homepage'

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => ActorModel)
  @Column
  actorId: number

  @BelongsTo(() => ActorModel, {
    foreignKey: {
      name: 'actorId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Actor: ActorModel

  static async updateInstanceHomepage (content: string) {
    const serverActor = await getServerActor()

    return ActorCustomPageModel.upsert({
      content,
      actorId: serverActor.id,
      type: 'homepage'
    })
  }

  static async loadInstanceHomepage () {
    const serverActor = await getServerActor()

    return ActorCustomPageModel.findOne({
      where: {
        actorId: serverActor.id
      }
    })
  }

  toFormattedJSON (): CustomPage {
    return {
      content: this.content
    }
  }
}
