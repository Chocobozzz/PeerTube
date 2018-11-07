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
var ApplicationModel_1;
const sequelize_typescript_1 = require("sequelize-typescript");
const account_1 = require("../account/account");
let ApplicationModel = ApplicationModel_1 = class ApplicationModel extends sequelize_typescript_1.Model {
    static countTotal() {
        return ApplicationModel_1.count();
    }
    static load() {
        return ApplicationModel_1.findOne();
    }
};
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(0),
    sequelize_typescript_1.IsInt,
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], ApplicationModel.prototype, "migrationVersion", void 0);
__decorate([
    sequelize_typescript_1.HasOne(() => account_1.AccountModel, {
        foreignKey: {
            allowNull: true
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", account_1.AccountModel)
], ApplicationModel.prototype, "Account", void 0);
ApplicationModel = ApplicationModel_1 = __decorate([
    sequelize_typescript_1.DefaultScope({
        include: [
            {
                model: () => account_1.AccountModel,
                required: true
            }
        ]
    }),
    sequelize_typescript_1.Table({
        tableName: 'application'
    })
], ApplicationModel);
exports.ApplicationModel = ApplicationModel;
