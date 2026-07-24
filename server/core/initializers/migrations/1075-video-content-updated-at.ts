import * as Sequelize from 'sequelize'  
  
async function up (utils: {  
  transaction: Sequelize.Transaction  
  queryInterface: Sequelize.QueryInterface  
  sequelize: Sequelize.Sequelize  
}): Promise<void> {  
  await utils.sequelize.query(  
    `ALTER TABLE "video" ADD COLUMN IF NOT EXISTS "contentUpdatedAt" TIMESTAMP WITH TIME ZONE`,  
    { transaction: utils.transaction }  
  )  
  
  await utils.sequelize.query(  
    `UPDATE "video" SET "contentUpdatedAt" = "updatedAt" WHERE "contentUpdatedAt" IS NULL`,  
    { transaction: utils.transaction }  
  )  
}  
  
function down (options) {  
  throw new Error('Not implemented.')  
}  
  
export {  
  down,  
  up  
}
