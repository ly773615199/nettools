'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Tunnel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Tunnel.init({
    name: DataTypes.STRING,
    localPort: DataTypes.STRING,
    remoteServer: DataTypes.STRING,
    remotePort: DataTypes.STRING,
    secret: DataTypes.STRING,
    status: DataTypes.STRING,
    userId: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Tunnel',
    tableName: 'Tunnel'
  });
  return Tunnel;
};