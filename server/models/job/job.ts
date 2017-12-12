import { values } from 'lodash'
import { AllowNull, Column, CreatedAt, DataType, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { JobCategory, JobState } from '../../../shared/models'
import { JOB_CATEGORIES, JOB_STATES } from '../../initializers'
import { getSort } from '../utils'

@Table({
  tableName: 'job',
  indexes: [
    {
      fields: [ 'state', 'category' ]
    }
  ]
})
export class JobModel extends Model<JobModel> {
  @AllowNull(false)
  @Column(DataType.ENUM(values(JOB_STATES)))
  state: JobState

  @AllowNull(false)
  @Column(DataType.ENUM(values(JOB_CATEGORIES)))
  category: JobCategory

  @AllowNull(false)
  @Column
  handlerName: string

  @AllowNull(true)
  @Column(DataType.JSON)
  handlerInputData: any

  @CreatedAt
  creationDate: Date

  @UpdatedAt
  updatedOn: Date

  static listWithLimitByCategory (limit: number, state: JobState, jobCategory: JobCategory) {
    const query = {
      order: [
        [ 'id', 'ASC' ]
      ],
      limit: limit,
      where: {
        state,
        category: jobCategory
      }
    }

    return JobModel.findAll(query)
  }

  static listForApi (start: number, count: number, sort: string) {
    const query = {
      offset: start,
      limit: count,
      order: [ getSort(sort) ]
    }

    return JobModel.findAndCountAll(query).then(({ rows, count }) => {
      return {
        data: rows,
        total: count
      }
    })
  }

  toFormattedJSON () {
    return {
      id: this.id,
      state: this.state,
      category: this.category,
      handlerName: this.handlerName,
      handlerInputData: this.handlerInputData,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
