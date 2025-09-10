import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { CustomPage } from '@peertube/peertube-models'
import { ActorModel } from '../actor/actor.js'
import { getServerActor } from '../application/application.js'
import { SequelizeModel } from '../shared/index.js'

@Table({
  tableName: 'actorCustomPage',
  indexes: [
    {
      fields: [ 'actorId', 'type' ],
      unique: true
    }
  ]
})
export class ActorCustomPageModel extends SequelizeModel<ActorCustomPageModel> {
  @AllowNull(true)
  @Column(DataType.TEXT)
  declare content: string

  @AllowNull(false)
  @Column
  declare type: 'homepage'

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => ActorModel)
  @Column
  declare actorId: number

  @BelongsTo(() => ActorModel, {
    foreignKey: {
      name: 'actorId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare Actor: Awaited<ActorModel>

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
