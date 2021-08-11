module.exports = {
  mysql: {
    host: "127.0.0.1",
    port: "3306",
    user: "root",
    password: "root",
    database: "serve",
  },
  parseTableNameBefore(tableName) {
    return tableName.split("_").slice(1).join("_");
  },
  arseTableNameAfter(tableName) {
    return tableName;
  },
};
