import { values } from 'lodash'

import { JOB_STATES } from '../initializers'

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const Job = sequelize.define('Job',
    {
      state: {
        type: DataTypes.ENUM(values(JOB_STATES)),
        allowNull: false
      },
      handlerName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      handlerInputData: {
        type: DataTypes.JSON,
        allowNull: true
      }
    },
    {
      indexes: [
        {
          fields: [ 'state' ]
        }
      ],
      classMethods: {
        listWithLimit
      }
    }
  )

  return Job
}

// ---------------------------------------------------------------------------

function listWithLimit (limit, state, callback) {
  const query = {
    order: [
      [ 'id', 'ASC' ]
    ],
    limit: limit,
    where: {
      state
    }
  }

  return this.findAll(query).asCallback(callback)
}
