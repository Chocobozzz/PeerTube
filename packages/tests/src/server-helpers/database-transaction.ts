/* oxlint-disable @typescript-eslint/no-unused-expressions */

import {
  addAfterCommitCallback,
  runSequelizeTransaction,
  trackInstancesSavedInTransactions
} from '@peertube/peertube-server/core/helpers/database-transaction.js'
import { CONFIG } from '@peertube/peertube-server/core/initializers/config.js'
import { expect } from 'chai'
import { DataTypes, Model, ModelStatic } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

type TestAttributes = { id: number, name: string, state: number, createdAt: Date }

describe('Database transaction helpers', function () {
  let sequelize: Sequelize
  let TestModel: ModelStatic<Model<TestAttributes, Partial<TestAttributes>> & TestAttributes>

  before(async function () {
    sequelize = new Sequelize({
      database: 'peertube_test1',
      dialect: 'postgres',
      host: CONFIG.DATABASE.HOSTNAME,
      port: CONFIG.DATABASE.PORT,
      username: CONFIG.DATABASE.USERNAME,
      password: CONFIG.DATABASE.PASSWORD,
      logging: false
    })

    trackInstancesSavedInTransactions(sequelize)

    TestModel = sequelize.define('TestDatabaseTransaction', {
      name: { type: DataTypes.STRING, allowNull: false },
      state: { type: DataTypes.INTEGER, allowNull: false }
    }, { tableName: 'testDatabaseTransaction' }) as typeof TestModel

    await TestModel.sync({ force: true })
  })

  it('Should restore instances saved in a transaction that does not commit', async function () {
    const instance = TestModel.build({ name: 'name 1', state: 1 })

    await expectRejection(() => {
      return runSequelizeTransaction(sequelize, {}, async transaction => {
        await instance.save({ transaction })
        throw new Error('rollback')
      })
    })

    expect(instance.isNewRecord).to.be.true
    expect(instance.id).to.be.null
    expect(instance.createdAt).to.be.undefined

    await runSequelizeTransaction(sequelize, {}, transaction => instance.save({ transaction }))

    expect(instance.isNewRecord).to.be.false
    expect(instance.id).to.be.a('number')
    expect(await TestModel.count()).to.equal(1)

    instance.name = 'name 2'

    await expectRejection(() => {
      return runSequelizeTransaction(sequelize, {}, async transaction => {
        await instance.save({ transaction })

        instance.state = 2
        await instance.save({ transaction })

        throw new Error('rollback')
      })
    })

    expect(instance.changed()).to.include.members([ 'name', 'state' ])
    expect(instance.previous('name')).to.equal('name 1')
    expect(instance.previous('state')).to.equal(1)

    await runSequelizeTransaction(sequelize, {}, transaction => instance.save({ transaction }))

    const fromDB = await TestModel.findByPk(instance.id)
    expect(fromDB.name).to.equal('name 2')
    expect(fromDB.state).to.equal(2)
  })

  it('Should run after commit callbacks only after a successful commit', async function () {
    const calls: string[] = []

    await expectRejection(() => {
      return runSequelizeTransaction(sequelize, {}, transaction => {
        addAfterCommitCallback(transaction, () => calls.push('rollback'))

        return Promise.reject(new Error('rollback'))
      })
    })

    expect(calls).to.have.lengthOf(0)

    const result = await runSequelizeTransaction(sequelize, {}, transaction => {
      addAfterCommitCallback(transaction, () => {
        throw new Error('callback error')
      })

      addAfterCommitCallback(transaction, () => {
        calls.push('first')

        addAfterCommitCallback(transaction, () => calls.push('nested'))
      })

      expect(calls).to.have.lengthOf(0)

      return Promise.resolve('result')
    })

    expect(result).to.equal('result')
    expect(calls).to.deep.equal([ 'first', 'nested' ])
  })

  after(async function () {
    await TestModel?.drop()
    await sequelize?.close()
  })
})

async function expectRejection (fn: () => Promise<any>) {
  let thrown = false

  try {
    await fn()
  } catch {
    thrown = true
  }

  expect(thrown, 'expected the promise to reject').to.be.true
}
