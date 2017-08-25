import * as Sequelize from 'sequelize'

export namespace VideoFileMethods {
}

export interface VideoFileClass {
}

export interface VideoFileAttributes {
  resolution: number
  size: number
  infoHash?: string
  extname: string

  videoId?: number
}

export interface VideoFileInstance extends VideoFileClass, VideoFileAttributes, Sequelize.Instance<VideoFileAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface VideoFileModel extends VideoFileClass, Sequelize.Model<VideoFileInstance, VideoFileAttributes> {}
