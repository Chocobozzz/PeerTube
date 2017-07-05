import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

export namespace TagMethods {
  export type FindOrCreateTags = (tags: string[], transaction: Sequelize.Transaction) => Promise<TagInstance[]>
}

export interface TagClass {
  findOrCreateTags: TagMethods.FindOrCreateTags
}

export interface TagAttributes {
  name: string
}

export interface TagInstance extends TagClass, TagAttributes, Sequelize.Instance<TagAttributes> {
  id: number
}

export interface TagModel extends TagClass, Sequelize.Model<TagInstance, TagAttributes> {}
