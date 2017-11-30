import * as Bluebird from 'bluebird'
import * as Sequelize from 'sequelize'
import { Job as FormattedJob, JobCategory, JobState } from '../../../shared/models/job.model'
import { ResultList } from '../../../shared/models/result-list.model'

export namespace JobMethods {
  export type ListWithLimitByCategory = (limit: number, state: JobState, category: JobCategory) => Bluebird<JobInstance[]>
  export type ListForApi = (start: number, count: number, sort: string) => Bluebird< ResultList<JobInstance> >

  export type ToFormattedJSON = (this: JobInstance) => FormattedJob
}

export interface JobClass {
  listWithLimitByCategory: JobMethods.ListWithLimitByCategory
  listForApi: JobMethods.ListForApi,
}

export interface JobAttributes {
  state: JobState
  category: JobCategory
  handlerName: string
  handlerInputData: any
}

export interface JobInstance extends JobClass, JobAttributes, Sequelize.Instance<JobAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  toFormattedJSON: JobMethods.ToFormattedJSON
}

export interface JobModel extends JobClass, Sequelize.Model<JobInstance, JobAttributes> {}
