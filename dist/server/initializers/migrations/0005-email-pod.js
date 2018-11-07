"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Sequelize = require("sequelize");
function up(utils) {
    const q = utils.queryInterface;
    const data = {
        type: Sequelize.STRING(400),
        allowNull: false,
        defaultValue: ''
    };
    return q.addColumn('Pods', 'email', data)
        .then(() => {
        const query = 'UPDATE "Pods" SET "email" = \'dummy@example.com\'';
        return utils.sequelize.query(query, { transaction: utils.transaction });
    })
        .then(() => {
        data.defaultValue = null;
        return q.changeColumn('Pods', 'email', data);
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
