"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Sequelize = require("sequelize");
function up(utils) {
    const q = utils.queryInterface;
    const data = {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null
    };
    return q.addColumn('Videos', 'language', data);
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
