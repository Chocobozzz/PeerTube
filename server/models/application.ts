module.exports = function (sequelize, DataTypes) {
  const Application = sequelize.define('Application',
    {
      migrationVersion: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
        validate: {
          isInt: true
        }
      }
    },
    {
      classMethods: {
        loadMigrationVersion,
        updateMigrationVersion
      }
    }
  )

  return Application
}

// ---------------------------------------------------------------------------

function loadMigrationVersion (callback) {
  const query = {
    attributes: [ 'migrationVersion' ]
  }

  return this.findOne(query).asCallback(function (err, data) {
    const version = data ? data.migrationVersion : null

    return callback(err, version)
  })
}

function updateMigrationVersion (newVersion, transaction, callback) {
  const options: { where?: any, transaction?: any } = {
    where: {}
  }

  if (!callback) {
    transaction = callback
  } else {
    options.transaction = transaction
  }

  return this.update({ migrationVersion: newVersion }, options).asCallback(callback)
}
