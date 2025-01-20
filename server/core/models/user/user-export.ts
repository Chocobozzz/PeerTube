import { FileStorage, UserExportState, type FileStorageType, type UserExport, type UserExportStateType } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import {
  JWT_TOKEN_USER_EXPORT_FILE_LIFETIME,
  DOWNLOAD_PATHS,
  USER_EXPORT_FILE_PREFIX,
  USER_EXPORT_STATES,
  WEBSERVER
} from '@server/initializers/constants.js'
import { removeUserExportObjectStorage } from '@server/lib/object-storage/user-export.js'
import { getFSUserExportFilePath } from '@server/lib/paths.js'
import { MUserAccountId, MUserExport } from '@server/types/models/index.js'
import { remove } from 'fs-extra/esm'
import jwt from 'jsonwebtoken'
import { join } from 'path'
import { FindOptions, Op } from 'sequelize'
import { AllowNull, BeforeDestroy, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { doesExist } from '../shared/query.js'
import { SequelizeModel } from '../shared/sequelize-type.js'
import { getSort } from '../shared/sort.js'
import { UserModel } from './user.js'

@Table({
  tableName: 'userExport',
  indexes: [
    {
      fields: [ 'userId' ]
    },
    {
      fields: [ 'filename' ],
      unique: true
    }
  ]
})
export class UserExportModel extends SequelizeModel<UserExportModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(true)
  @Column
  filename: string

  @AllowNull(false)
  @Column
  withVideoFiles: boolean

  @AllowNull(false)
  @Column
  state: UserExportStateType

  @AllowNull(true)
  @Column(DataType.TEXT)
  error: string

  @AllowNull(true)
  @Column(DataType.BIGINT)
  size: number

  @AllowNull(false)
  @Column
  storage: FileStorageType

  @AllowNull(true)
  @Column
  fileUrl: string

  @ForeignKey(() => UserModel)
  @Column
  userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  User: Awaited<UserModel>

  @BeforeDestroy
  static removeFile (instance: UserExportModel) {
    logger.info('Removing user export file %s.', instance.filename)

    if (instance.storage === FileStorage.FILE_SYSTEM) {
      remove(getFSUserExportFilePath(instance))
        .catch(err => logger.error('Cannot delete user export archive %s from filesystem.', instance.filename, { err }))
    } else {
      removeUserExportObjectStorage(instance)
        .catch(err => logger.error('Cannot delete user export archive %s from object storage.', instance.filename, { err }))
    }

    return undefined
  }

  static listByUser (user: MUserAccountId) {
    const query: FindOptions = {
      where: {
        userId: user.id
      }
    }

    return UserExportModel.findAll<MUserExport>(query)
  }

  static listExpired (expirationTimeMS: number) {
    const query: FindOptions = {
      where: {
        createdAt: {
          [Op.lt]: new Date(new Date().getTime() - expirationTimeMS)
        }
      }
    }

    return UserExportModel.findAll<MUserExport>(query)
  }

  static listForApi (options: {
    user: MUserAccountId
    start: number
    count: number
  }) {
    const { count, start, user } = options

    const query: FindOptions = {
      offset: start,
      limit: count,
      order: getSort('createdAt'),
      where: {
        userId: user.id
      }
    }

    return Promise.all([
      UserExportModel.count(query),
      UserExportModel.findAll<MUserExport>(query)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static load (id: number | string) {
    return UserExportModel.findByPk<MUserExport>(id)
  }

  static loadByFilename (filename: string) {
    return UserExportModel.findOne<MUserExport>({ where: { filename } })
  }

  // ---------------------------------------------------------------------------

  static async doesOwnedFileExist (filename: string, storage: FileStorageType) {
    const query = 'SELECT 1 FROM "userExport" ' +
      `WHERE "filename" = $filename AND "storage" = $storage LIMIT 1`

    return doesExist({ sequelize: this.sequelize, query, bind: { filename, storage } })
  }

  // ---------------------------------------------------------------------------

  generateAndSetFilename () {
    if (!this.userId) throw new Error('Cannot generate filename without userId')
    if (!this.createdAt) throw new Error('Cannot generate filename without createdAt')

    this.filename = `${USER_EXPORT_FILE_PREFIX}${this.userId}-${this.createdAt.toISOString()}.zip`
  }

  canBeSafelyRemoved () {
    const supportedStates = new Set<UserExportStateType>([ UserExportState.COMPLETED, UserExportState.ERRORED, UserExportState.PENDING ])

    return supportedStates.has(this.state)
  }

  generateJWT () {
    return jwt.sign(
      {
        userExportId: this.id
      },
      CONFIG.SECRETS.PEERTUBE,
      {
        expiresIn: JWT_TOKEN_USER_EXPORT_FILE_LIFETIME,
        audience: this.filename,
        issuer: WEBSERVER.URL
      }
    )
  }

  isJWTValid (jwtToken: string) {
    try {
      const payload = jwt.verify(jwtToken, CONFIG.SECRETS.PEERTUBE, {
        audience: this.filename,
        issuer: WEBSERVER.URL
      })

      if ((payload as any).userExportId !== this.id) return false

      return true
    } catch {
      return false
    }
  }

  getFileDownloadUrl () {
    if (this.state !== UserExportState.COMPLETED) return null

    return WEBSERVER.URL + join(DOWNLOAD_PATHS.USER_EXPORTS, this.filename) + '?jwt=' + this.generateJWT()
  }

  // ---------------------------------------------------------------------------

  toFormattedJSON (this: MUserExport): UserExport {
    return {
      id: this.id,

      state: {
        id: this.state,
        label: USER_EXPORT_STATES[this.state]
      },

      size: this.size,

      fileUrl: this.fileUrl,
      privateDownloadUrl: this.getFileDownloadUrl(),
      createdAt: this.createdAt.toISOString(),
      expiresOn: new Date(this.createdAt.getTime() + CONFIG.EXPORT.USERS.EXPORT_EXPIRATION).toISOString()
    }
  }

}
