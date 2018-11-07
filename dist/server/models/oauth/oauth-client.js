"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
var OAuthClientModel_1;
const sequelize_typescript_1 = require("sequelize-typescript");
const oauth_token_1 = require("./oauth-token");
let OAuthClientModel = OAuthClientModel_1 = class OAuthClientModel extends sequelize_typescript_1.Model {
    static countTotal() {
        return OAuthClientModel_1.count();
    }
    static loadFirstClient() {
        return OAuthClientModel_1.findOne();
    }
    static getByIdAndSecret(clientId, clientSecret) {
        const query = {
            where: {
                clientId: clientId,
                clientSecret: clientSecret
            }
        };
        return OAuthClientModel_1.findOne(query);
    }
};
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], OAuthClientModel.prototype, "clientId", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], OAuthClientModel.prototype, "clientSecret", void 0);
__decorate([
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.ARRAY(sequelize_typescript_1.DataType.STRING)),
    __metadata("design:type", Array)
], OAuthClientModel.prototype, "grants", void 0);
__decorate([
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.ARRAY(sequelize_typescript_1.DataType.STRING)),
    __metadata("design:type", Array)
], OAuthClientModel.prototype, "redirectUris", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], OAuthClientModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], OAuthClientModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.HasMany(() => oauth_token_1.OAuthTokenModel, {
        onDelete: 'cascade'
    }),
    __metadata("design:type", Array)
], OAuthClientModel.prototype, "OAuthTokens", void 0);
OAuthClientModel = OAuthClientModel_1 = __decorate([
    sequelize_typescript_1.Table({
        tableName: 'oAuthClient',
        indexes: [
            {
                fields: ['clientId'],
                unique: true
            },
            {
                fields: ['clientId', 'clientSecret'],
                unique: true
            }
        ]
    })
], OAuthClientModel);
exports.OAuthClientModel = OAuthClientModel;
