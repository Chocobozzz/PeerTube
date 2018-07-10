import * as Sequelize from 'sequelize'
import { createClient } from 'redis'
import { CONFIG } from '../constants'
import { JobQueue } from '../../lib/job-queue'
import { initDatabaseModels } from '../database'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {
  await initDatabaseModels(false)

  return new Promise((res, rej) => {
    const client = createClient({
      host: CONFIG.REDIS.HOSTNAME,
      port: CONFIG.REDIS.PORT,
      db: CONFIG.REDIS.DB
    })

    const jobsPrefix = 'q-' + CONFIG.WEBSERVER.HOST

    client.sort(jobsPrefix + ':jobs:inactive', 'by', 'alpha', 'ASC', (err, jobStrings) => {
      if (err) return rej(err)

      const jobPromises = jobStrings
        .map(s => s.split('|'))
        .map(([ , jobId ]) => {
          return new Promise((res, rej) => {
            client.hgetall(jobsPrefix + ':job:' + jobId, (err, job) => {
              if (err) return rej(err)

              try {
                const parsedData = JSON.parse(job.data)

                return res({ type: job.type, payload: parsedData })
              } catch (err) {
                console.error('Cannot parse data %s.', job.data)
                return res(null)
              }
            })
          })
        })

      JobQueue.Instance.init()
              .then(() => Promise.all(jobPromises))
              .then((jobs: any) => {
                const createJobPromises = jobs
                  .filter(job => job !== null)
                  .map(job => JobQueue.Instance.createJob(job))

                return Promise.all(createJobPromises)
              })
              .then(() => res())
    })
  })
}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
