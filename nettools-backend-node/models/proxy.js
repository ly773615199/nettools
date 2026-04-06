'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Proxy extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Proxy.init({
    name: DataTypes.STRING,
    type: DataTypes.STRING,
    server: DataTypes.STRING,
    port: DataTypes.STRING,
    status: DataTypes.STRING,
    config: DataTypes.TEXT,
    userId: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Proxy',
    tableName: 'Proxy'
  });
  return Proxy;
};