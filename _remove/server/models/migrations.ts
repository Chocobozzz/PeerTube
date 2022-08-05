import { ModelAttributeColumnOptions } from 'sequelize'

declare namespace Migration {
  interface Boolean extends ModelAttributeColumnOptions {
    defaultValue: boolean | null
  }

  interface String extends ModelAttributeColumnOptions {
    defaultValue: string | null
  }

  interface Integer extends ModelAttributeColumnOptions {
    defaultValue: number | null
  }

  interface BigInteger extends ModelAttributeColumnOptions {
    defaultValue: number | null
  }

  interface UUID extends ModelAttributeColumnOptions {
    defaultValue: null
  }
}

export {
  Migration
}
