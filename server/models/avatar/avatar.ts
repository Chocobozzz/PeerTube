import * as Sequelize from 'sequelize'
import { addMethodsToModel } from '../utils'
import { AvatarAttributes, AvatarInstance } from './avatar-interface'

let Avatar: Sequelize.Model<AvatarInstance, AvatarAttributes>

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  Avatar = sequelize.define<AvatarInstance, AvatarAttributes>('Avatar',
    {
      filename: {
        type: DataTypes.STRING,
        allowNull: false
      }
    },
    {}
  )

  const classMethods = []
  addMethodsToModel(Avatar, classMethods)

  return Avatar
}

// ------------------------------ Statics ------------------------------
