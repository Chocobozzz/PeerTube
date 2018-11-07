"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Sequelize = require("sequelize");
function up(utils) {
    const q = utils.queryInterface;
    const data = {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    };
    return q.addColumn('Videos', 'nsfw', data)
        .then(() => {
        data.defaultValue = null;
        return q.changeColumn('Videos', 'nsfw', data);
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
