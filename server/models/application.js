module.exports = function (sequelize, DataTypes) {
  const Application = sequelize.define('Application',
    {
      sqlSchemaVersion: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      }
    },
    {
      classMethods: {
        loadSqlSchemaVersion,
        updateSqlSchemaVersion
      }
    }
  )

  return Application
}

// ---------------------------------------------------------------------------

function loadSqlSchemaVersion (callback) {
  const query = {
    attributes: [ 'sqlSchemaVersion' ]
  }

  return this.findOne(query).asCallback(function (err, data) {
    const version = data ? data.sqlSchemaVersion : 0

    return callback(err, version)
  })
}

function updateSqlSchemaVersion (newVersion, callback) {
  return this.update({ sqlSchemaVersion: newVersion }).asCallback(callback)
}
