---
title: My_First_Blog
date: 2025-01-16 20:31:33
---

这是我的第一篇博客，这个博客搭建花了很多时间，遇到了很多问题，在这里分享一下

# 环境配置

首先是环境的配置 

你需要安装 `node.js` 作为包管理器进行 `Hexo` 网站的搭建

其次你需要将 `git` 与你的 `github` 账号建立SSH通道

然后进行Hexo的安装：

```text
npm install hexo -g
```

接着新建一个文件夹作为你的本地博客的文件，进行安装Hexo的依赖

```text 
npm install --save hexo-deployer-git
```

# 搭建博客

## 初始化

首先我们需要创建一个用于存放博客的文件目录，然后cd进入目录，并对其进行初始化

```text
hexo init
```

因为我遇到一些问题，所以我是直接从Github下载解压到本地

如果你也遇到这个问题从这里

[下载]([hexojs/hexo-starter: Hexo Starter site (use `npx hexo init myBlog`) (github.com)](https://github.com/hexojs/hexo-starter))

当初始化结束后我们可以看到以下文件出现在我们的目录中

![None](https://s2.loli.net/2025/01/16/DfI2Wp4jCrexPiu.png)

## 测试效果

接着我们生成页面

```text 
hexo generate
```

然后我们通过本地网站打开

```text 
hexo server
```

然后在http://localhost:4000/查看效果

##  上传部署

首先创建一个仓库（注意命名：用户名.gitihub.io）比如这里我是Ylin07.github.io

然后我们在本地博客存放的文件中对`_config.yml`进行以下编辑：

```yaml
deploy:
  type: git
  repository: git@github.com:Ylin07/Ylin07.github.io.git
  branch: main
```

接下来我们进行Hexo的三部曲

+ `hexo clean`
+ `hexo g`
+ `hexo d`

这里最后的 `hexo d`我遇到了一个问题，就是始终部署失败

我在网上找到的解决办法是在`C:\Windows\System32\drivers\etc`下的hosts文件添加github的IP地址，其操作如下：

```cmd
notepad C:/Windows/System32/drivers/etc/hosts
```

在最下面添加

```
    140.82.112.4 github.com
```

然后保存即可，这样就完成了对网站的部署，接下来让我们看看效果吧

