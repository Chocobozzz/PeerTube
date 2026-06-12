import * as Sequelize from 'sequelize'

export async function up (queryInterface: Sequelize.QueryInterface) {
  await queryInterface.addColumn('video', 'recommendationPolicy', {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 1 // ANY_VIDEOS
  })
}

export async function down (queryInterface: Sequelize.QueryInterface) {
  await queryInterface.removeColumn('video', 'recommendationPolicy')
}
