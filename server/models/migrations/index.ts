import * as Sequelize from 'sequelize'

declare namespace Migration {
  interface Boolean extends Sequelize.DefineAttributeColumnOptions {
    defaultValue: boolean | null
  }

  interface String extends Sequelize.DefineAttributeColumnOptions {
    defaultValue: string | null
  }

  interface Integer extends Sequelize.DefineAttributeColumnOptions {
    defaultValue: number | null
  }

  interface BigInteger extends Sequelize.DefineAttributeColumnOptions {
    defaultValue: Sequelize.DataTypeBigInt | number | null
  }

  interface UUID extends Sequelize.DefineAttributeColumnOptions {
    defaultValue: Sequelize.DataTypeUUIDv4 | null
  }
}

export {
  Migration
}
