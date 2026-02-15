import { DataTypes, QueryInterface } from 'sequelize'

export async function up (utils: { queryInterface: QueryInterface }) {
  const { queryInterface } = utils

  await queryInterface.addColumn('videoLive', 'dvrWindowSeconds', {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 7200
  })
}

export async function down (utils: { queryInterface: QueryInterface }) {
  const { queryInterface } = utils

  await queryInterface.removeColumn('videoLive', 'dvrWindowSeconds')
}
