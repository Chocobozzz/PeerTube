"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_typescript_1 = require("sequelize-typescript");
function getSort(value, lastSort = ['id', 'ASC']) {
    let { direction, field } = buildDirectionAndField(value);
    if (field.toLowerCase() === 'match') {
        field = sequelize_typescript_1.Sequelize.col('similarity');
    }
    return [[field, direction], lastSort];
}
exports.getSort = getSort;
function getVideoSort(value, lastSort = ['id', 'ASC']) {
    let { direction, field } = buildDirectionAndField(value);
    if (field.toLowerCase() === 'match') {
        field = sequelize_typescript_1.Sequelize.col('similarity');
    }
    else if (field.toLowerCase() === 'trending') {
        return [
            [sequelize_typescript_1.Sequelize.fn('COALESCE', sequelize_typescript_1.Sequelize.fn('SUM', sequelize_typescript_1.Sequelize.col('VideoViews.views')), '0'), direction],
            [sequelize_typescript_1.Sequelize.col('VideoModel.views'), direction],
            lastSort
        ];
    }
    return [[field, direction], lastSort];
}
exports.getVideoSort = getVideoSort;
function getSortOnModel(model, value, lastSort = ['id', 'ASC']) {
    let [firstSort] = getSort(value);
    if (model)
        return [[model, firstSort[0], firstSort[1]], lastSort];
    return [firstSort, lastSort];
}
exports.getSortOnModel = getSortOnModel;
function throwIfNotValid(value, validator, fieldName = 'value') {
    if (validator(value) === false) {
        throw new Error(`"${value}" is not a valid ${fieldName}.`);
    }
}
exports.throwIfNotValid = throwIfNotValid;
function buildTrigramSearchIndex(indexName, attribute) {
    return {
        name: indexName,
        fields: [sequelize_typescript_1.Sequelize.literal('lower(immutable_unaccent(' + attribute + '))')],
        using: 'gin',
        operator: 'gin_trgm_ops'
    };
}
exports.buildTrigramSearchIndex = buildTrigramSearchIndex;
function createSimilarityAttribute(col, value) {
    return sequelize_typescript_1.Sequelize.fn('similarity', searchTrigramNormalizeCol(col), searchTrigramNormalizeValue(value));
}
exports.createSimilarityAttribute = createSimilarityAttribute;
function buildBlockedAccountSQL(serverAccountId, userAccountId) {
    const blockerIds = [serverAccountId];
    if (userAccountId)
        blockerIds.push(userAccountId);
    const blockerIdsString = blockerIds.join(', ');
    const query = 'SELECT "targetAccountId" AS "id" FROM "accountBlocklist" WHERE "accountId" IN (' + blockerIdsString + ')' +
        ' UNION ALL ' +
        'SELECT "account"."id" AS "id" FROM account INNER JOIN "actor" ON account."actorId" = actor.id ' +
        'INNER JOIN "serverBlocklist" ON "actor"."serverId" = "serverBlocklist"."targetServerId" ' +
        'WHERE "serverBlocklist"."accountId" IN (' + blockerIdsString + ')';
    return query;
}
exports.buildBlockedAccountSQL = buildBlockedAccountSQL;
function searchTrigramNormalizeValue(value) {
    return sequelize_typescript_1.Sequelize.fn('lower', sequelize_typescript_1.Sequelize.fn('immutable_unaccent', value));
}
function searchTrigramNormalizeCol(col) {
    return sequelize_typescript_1.Sequelize.fn('lower', sequelize_typescript_1.Sequelize.fn('immutable_unaccent', sequelize_typescript_1.Sequelize.col(col)));
}
function buildDirectionAndField(value) {
    let field;
    let direction;
    if (value.substring(0, 1) === '-') {
        direction = 'DESC';
        field = value.substring(1);
    }
    else {
        direction = 'ASC';
        field = value;
    }
    return { direction, field };
}
//# sourceMappingURL=utils.js.map