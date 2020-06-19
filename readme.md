## websir-mysql 是什么？

用于根据指定的 mysql 数据库接口 生成：

- JSON
- typescript-interface (用于语法提示)
- vscode code-snippets (用于在 js 中快速输入)

## 安装

```
npm install webisr-mysql -D
```

## 配置

项目根创建 websir.config.js 文件
写入正确的数据库配置

```
module.exports = {
  mysql: {
    host: "<数据库地址>",
    port: "<端口>",
    user: "<用户名>",
    password: "<密码>",
    database: "<库名>"
  }
}

例：

module.exports = {
    mysql: {
        host: "127.0.0.1",
        port: "3306",
        user: "root",
        password: "root",
        database: "qqs"
    }
}


```

## 生成

package.json 中

```
 "scripts": {
    "websir": "websir-mysql"
  }
```

命令行

```
npm run websir
```

## 使用

### 生成 html

.vue(html) / .html
`#表名`

.js / .vue(js)
`@表名`

### 生成 js 属性
