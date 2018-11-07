"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Sequelize = require("sequelize");
function up(utils) {
    const q = utils.queryInterface;
    const data = {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
    };
    return q.addColumn('Videos', 'licence', data)
        .then(() => {
        data.defaultValue = null;
        return q.changeColumn('Videos', 'licence', data);
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
