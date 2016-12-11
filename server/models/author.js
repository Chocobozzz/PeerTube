module.exports = function (sequelize, DataTypes) {
  const Author = sequelize.define('Author',
    {
      name: {
        type: DataTypes.STRING
      }
    },
    {
      classMethods: {
        associate
      }
    }
  )

  return Author
}

// ---------------------------------------------------------------------------

function associate (models) {
  this.belongsTo(models.Pod, {
    foreignKey: {
      name: 'podId',
      allowNull: true
    },
    onDelete: 'cascade'
  })
}
