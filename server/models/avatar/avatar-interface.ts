import * as Sequelize from 'sequelize'

export namespace AvatarMethods {}

export interface AvatarClass {}

export interface AvatarAttributes {
  filename: string
}

export interface AvatarInstance extends AvatarClass, AvatarAttributes, Sequelize.Instance<AvatarAttributes> {
  createdAt: Date
  updatedAt: Date
}

export interface AvatarModel extends AvatarClass, Sequelize.Model<AvatarInstance, AvatarAttributes> {}
