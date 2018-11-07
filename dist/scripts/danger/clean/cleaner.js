"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
const rimraf = require("rimraf");
const initializers_1 = require("../../../server/initializers");
initializers_1.initDatabaseModels(true)
    .then(() => {
    return initializers_1.sequelizeTypescript.drop();
})
    .then(() => {
    console.info('Tables of %s deleted.', initializers_1.CONFIG.DATABASE.DBNAME);
    const STORAGE = initializers_1.CONFIG.STORAGE;
    Promise.mapSeries(Object.keys(STORAGE), storage => {
        const storageDir = STORAGE[storage];
        return new Promise((res, rej) => {
            rimraf(storageDir, err => {
                if (err)
                    return rej(err);
                console.info('%s deleted.', storageDir);
                return res();
            });
        });
    })
        .then(() => process.exit(0));
});
//# sourceMappingURL=cleaner.js.map