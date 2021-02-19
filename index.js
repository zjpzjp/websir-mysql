#!/usr/bin/env node

let debug = require("debug")("websir-mysql");
debug.enabled = true;
const mysql = require("mysql");
const fs = require("fs");
const path = require("path");
let websirConfig = {
  host: "", //ip
  port: "", //端口
  user: "",
  password: "",
  database: "", //库名
};

try {
  websirConfig = require(path.resolve(process.cwd(), "websir.config.js"));
} catch (err) {
  debug("没有找到配置文件!,将自动在根目录创建websir.config.js");
  fs.copyFileSync(path.resolve("./node_modules/websir-mysql/websir.config.js"), "./websir.config.js");
  debug("创建完成！请打开 websir.config.js 进行配置！");
  process.exit(0);
}

try {
  var connection = mysql.createConnection(websirConfig.mysql);
  connection.query(
    `select * from information_schema.columns left join information_schema.tables on information_schema.columns.table_name=information_schema.tables.table_name where information_schema.columns.table_schema ='${websirConfig.mysql.database}'`,
    function (error, results, fields) {
      if (error) throw error;
      getAllTable(results);
      connection.end();
      // process.exit(0)
    }
  );
  connection.on("error", function (err) {
    debug(err.sqlMessage);
  });
} catch (err) {
  debug(err.message);
}

var dict = {}; //列字典 {列名:列的数据类型}
var commentDict = {}; //备注字典 {表名:{列名:comment,...},...}
var tableCommitDict = {}; //表名备注字典
function getAllTable(cols) {
  cols.map((item) => {
    tableCommitDict[item.TABLE_NAME] = item.TABLE_COMMENT;
    var tableName = camelCase(item.TABLE_NAME);
    commentDict[tableName] = commentDict[tableName] || {};
    dict[tableName] = dict[tableName] || {};
    var colName = camelCase(item.COLUMN_NAME);
    dict[tableName][colName] = item.DATA_TYPE;
    commentDict[tableName][colName] = `${item.COLUMN_COMMENT}`;
  });
  compileTS(); //生成data.d.ts
  compileJSON(); //处理JSON
  compileEditor(); //处理编辑器中javascript部分【快速输入字段】
}

function compileEditor() {
  var str = {};
  var strWord = {};
  //mysql 类型对应 js中的初始值
  var sql2jsVal = {
    int: "''",
    smallint: "''",
    tinyint: "''",
    datetime: "''",
    decimal: "''",
    double: "''",
    bigint: "''",
    char: "''",
    varchar: "''",
  };
  /**
    1） js快速输入：vscode中  js部分@表名  例如 @user
     "@user": {
       "scope": "javascript,typescript",
       "prefix": "@user",
       "body": ["userId:'',\n userName:''\n"],
       "description": "Log output to console"
     }
     2）html中快速输入<el-table-column prop=\"...\" label=\"...\"></el-table-column> 输入#表名 例如 #user
        "#user": {
          "scope": "vue-html,html",
          "prefix": "#user",
          "body": [
            "<el-table-column prop=\"estateType\" label=\"物产类型\"></el-table-column>"
          ]
        }
     */
  Object.keys(dict).map((dataItemKey) => {
    var jsBody = [];
    var htmlBody = [];

    strWord[`${dataItemKey}`] = {
      prefix: `${dataItemKey}`,
      body: [dataItemKey],
      description: `${dataItemKey}\n ${tableCommitDict[dataItemKey]} \n`,
    };
    tableCommitDict;
    for (key in dict[dataItemKey]) {
      var defaultVal = sql2jsVal[dict[dataItemKey][key]];
      defaultVal = defaultVal ? defaultVal : "''";
      jsBody.push(`${key}:${defaultVal}`);
      htmlBody.push(`<el-table-column prop=\"${key}\" label=\"${commentDict[dataItemKey][key]}\"></el-table-column>`);
      //所有文件环境下增加单词提示
      strWord[`${key}`] = {
        prefix: `${key}`,
        body: [key],
        description: `${dataItemKey}(${tableCommitDict[dataItemKey]})\n ${commentDict[dataItemKey][key]} \n`,
      };
      strWord[`${dataItemKey}.${key}`] = {
        prefix: `${dataItemKey}.${key}`,
        body: [key],
        description: `${dataItemKey}(${tableCommitDict[dataItemKey]})\n ${commentDict[dataItemKey][key]} \n`,
      };
    }
    str[`#${dataItemKey}`] = {
      scope: "vue-html,html",
      prefix: `#${dataItemKey}`,
      body: [htmlBody.join(",\n")],
      description: `快速输入 ${dataItemKey}`,
    };
    str[`@${dataItemKey}`] = {
      scope: "javascript,typescript",
      prefix: `@${dataItemKey}`,
      body: [jsBody.join(",\n")],
      description: `快速输入 ${dataItemKey}`,
    };
  });

  let filePath = path.resolve(process.cwd(), ".vscode/data.code-snippets");
  let filePathWord = path.resolve(process.cwd(), ".vscode/word.code-snippets");
  let dirPath = path.resolve(process.cwd(), ".vscode");
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
  fs.writeFile(filePath, JSON.stringify(str), function (err) {
    if (err) {
      console.log(err);
    } else {
      debug("已存入" + filePath);
    }
  });
  fs.writeFile(filePathWord, JSON.stringify(strWord), function (err) {
    if (err) {
      console.log(err);
    } else {
      debug("已存入" + filePath);
    }
  });
}

function compileJSON() {
  //写入json

  let filePath = path.resolve(process.cwd(), "websir-mysql-data.json");
  fs.writeFile(filePath, JSON.stringify(dict), function (err) {
    if (err) {
      console.log(err);
    } else {
      debug("已存入" + filePath);
    }
  });
}

function compileTS() {
  var types = "";

  Object.keys(dict).map((key) => {
    types += `declare var ${key}: ${key};\n`;
    // declare var user: User;
  });

  for (var dataItem in dict) {
    types += obj2ts(dict[dataItem], dataItem) + "\n";
  }
  //写入ts
  let filePath = path.resolve(process.cwd(), "websir-mysql-data.d.ts");
  fs.writeFile(filePath, types, function (err) {
    if (err) {
      console.log(err);
    } else {
      debug("已存入" + filePath);
    }
  });
}

function obj2ts(obj, name) {
  var sql2jsType = {
    int: "number",
    smallint: "number",
    tinyint: "number",
    datetime: "number",
    decimal: "number",
    double: "number",
    bigint: "number",
    char: "string",
    varchar: "string",
  };
  //组装成ts中的interface
  var temp = `interface ${name}{`;
  for (var key in obj) {
    temp += `
/**
*@${key} ​ ${commentDict[name][key]}
*/
`;
    var type = sql2jsType[obj[key]];
    type = type ? type : "string";
    temp += `${key}:${type};\n`;
  }
  temp += `}\n`;
  return temp;
}

function camelCase(string) {
  if (!string) {
    return false;
  }
  return string.replace(/_([a-z])/g, function (all, letter) {
    return letter.toUpperCase();
  });
}
