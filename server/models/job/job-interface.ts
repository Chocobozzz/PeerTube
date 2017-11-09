import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { JobCategory, JobState } from '../../../shared/models/job.model'

export namespace JobMethods {
  export type ListWithLimitByCategory = (limit: number, state: JobState, category: JobCategory) => Promise<JobInstance[]>
}

export interface JobClass {
  listWithLimitByCategory: JobMethods.ListWithLimitByCategory
}

export interface JobAttributes {
  state: JobState
  handlerName: string
  handlerInputData: object
}

export interface JobInstance extends JobClass, JobAttributes, Sequelize.Instance<JobAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface JobModel extends JobClass, Sequelize.Model<JobInstance, JobAttributes> {}
