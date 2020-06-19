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
    debug("没有找到配置文件!,请在根目录创建websir.config.js");
    process.exit(0);
}

try {
    var connection = mysql.createConnection(websirConfig.mysql);
    connection.query(
        `select * from information_schema.columns where table_schema ='${websirConfig.mysql.database}'`,
        function (error, results, fields) {
            if (error) throw error;
            getAllTable(results);
        }
    );
    connection.on("error", function (err) {
        debug(err.sqlMessage)
    });
} catch (err) {
    debug(err.message)
}

var dict = {}; //列字典 {列名:列的数据类型}
var commentDict = {}; //备注字典 {表名:{列名:comment,...},...}
function getAllTable(cols) {
    cols.map((item) => {
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
        for (var key in dict[dataItemKey]) {
            var defaultVal = sql2jsVal[dict[dataItemKey][key]];
            defaultVal = defaultVal ? defaultVal : "''";
            jsBody.push(`${key}:${defaultVal}`);
            htmlBody.push(
                `<el-table-column prop=\"${key}\" label=\"${commentDict[dataItemKey][key]}\"></el-table-column>`
            );
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
    let dirPath = path.resolve(process.cwd(), ".vscode");
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath)
    }
    fs.writeFile(filePath, JSON.stringify(str),
        function (err) {
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