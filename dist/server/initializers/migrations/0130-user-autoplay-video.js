"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Sequelize = require("sequelize");
function up(utils) {
    const q = utils.queryInterface;
    const data = {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
    };
    return q.addColumn('user', 'autoPlayVideo', data);
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
