---
title: 使用Git(上)
date: 2025-04-18 19:15:09
series: "工具链学习"
weight: 1
---

朋友圈里看到同学用Git，觉得图形化还是很帅的。加上最近刚好有需求，所以就来系统的学习一下git的使用。

这里参考的教程是：[简介 - Git教程 - 廖雪峰的官方网站](https://liaoxuefeng.com/books/git/introduction/index.html)

先从git在本地的简单使用开始学习一下吧，明天再接着讲讲git的远程使用

# Git

git是一款分布式的版本管理器。

分布式的意思就是一个每个开发者人的工作区就是一个完整的版本库。你的修改，和分支都可以再本地仓库里面完成，然后再推送到远程仓库中。不同的开发者之间通过向远程仓库push修改，或者从远程仓库pull操作，从而实现同步代码。

#  初见Git

这里我选择在WSL中使用git，可以通过`sudo apt-get install git`下载git

然后我们需要对我们git进行配置，我们需要初始化自己的信息：

```bash
$ git config --global user.name "Your Name"
$ git config --global user.email "email@example.com"
```

这里的`--global`参数指的是对本机器的所有仓库都使用这个信息，当然你也可以在不同的仓库中使用不同的用户信息。

# 版本库

我们刚刚所说的仓库实际上就是版本库（Repository），之后我们会频繁的看到这个单词。在这里，你可以讲仓库理解成一个目录，里面的内容被git管理起来（被其跟踪修改，记录历史，或者在之后用来"还原"）

首先我们创建一个版本库作为我们的练习：

```bash
$ mkdir learn_git
$ cd learn_git/
$ pwd
/home/ylin/Program/learn_git
```

然后使用`git init`对我们的仓库进行初始化：

```bash
$ git init
Initialized empty Git repository in /home/ylin/Program/learn_git/.git/
```

然后我们可以在当前目录下找到一个`.git`目录，不过它是隐藏的，所以我们使用`ls -ah`来找到它，这个目录用来跟踪管理版本库的。

## 向版本库中添加文件

这里我们需要搞清楚一件事，就是所有的版本控制器，只能管理文本文件，无法管理二进制文件。你可以管理文本文件，哪里被修改了，哪里增加了，但是你不能追踪一张图片被做了什么修改。

现在我们向我们的鹅目录下写一个`readme.txt`文件：

```text
Hello Git!
```

接下来我们将其提交到我们的仓库，需要以下过程：

+ 将文件添加到仓库：`git add readme.txt`
+ 将文件提交到仓库：`git commit -m "..."`(-m 后面用来添加改动记录，也可以不加)

这个是加入仓库后的结果：

```bash
[master (root-commit) 1428371] wrote a read file
 1 file changed, 1 insertion(+)
 create mode 100644 readme.txt
```

其中`1 file changed`是因为我们添加了一个文件；` 1 insertion(+)`是因为我们添加了一行内容

这里的`git add`和`git commit`之所以分开的原因后面会解释。现在我们只需要知道，`add`可以添加很多次很多内容，`commit`则是将添加的内容全部提交上去

# 版本管理

我们刚刚成功的添加并提交了`readme.txt`文件，现在我们继续工作，向其中添加内容，改成：

```text
Hello Git!!!
I love you！
```

现在运行`git status`命令看看结果：

```bash
$ git status
On branch master
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   readme.txt

no changes added to commit (use "git add" and/or "git commit -a")
```

通过这个命令我们可以时刻掌握仓库当前的状态，例如上面的信息告诉我们，`readme.txt`的内容被修改了，但是我们还没有提交该修改。

可是我们只知道文件被修改了，但我们并不知道哪些地方被修改了，所以我们使用`git diff`来查看一下：

```bash
$ git diff readme.txt
diff --git a/readme.txt b/readme.txt
index 106287c..94d4f0e 100644
--- a/readme.txt
+++ b/readme.txt
@@ -1 +1,2 @@
-Hello Git!
+Hello Git!!!
+I love you！
```

顾名思义这个指令是用来查看difference的，显示的格式是Unix通用的diff格式，注意其中的`@@ -1 +1,2 @@`。`-`后面的两个值分别是原始文件的差异起始行和差异行数，`+`后面的两个值分别是修改文件的差异起始行和差异行数。这些信息常用于定位文件的修改内容和修改范围。知道文件哪些地方被修改之后，我们再次将我们的`readme.txt`提交到我们的仓库中：

```bash
$ git status
On branch master
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
        modified:   readme.txt

```

我们再次运行`git status`看看当前仓库的状态，我们看到我们将要提交的修改的内容有`readme.txt`

现在我们将其提交`git commit`:

```bash
$ git commit -m "add my love"
[master 20deae4] add my love
 1 file changed, 2 insertions(+), 1 deletion(-)
```

然后再看看仓库，`git status`:

```bash
$ git status
On branch master
nothing to commit, working tree clean
```

Git告诉我们，当前没有要提交的内容，且工作目录是干净的

## 版本回退

我现在已经了解了怎么修改，我们尝试对其进行再一次的修改和提交：

```text
Hello Git!!!
I love you!
Sorry I love her more.
```

然后再次提交：

```bash
$ git add readme.txt
$ git commit -m "add sorry"
[master da91da7] add sorry
 1 file changed, 2 insertions(+), 1 deletion(-)
```

这个过程在实际的项目中会重复很多次，每当文件修改到一定的程度我们将其`commit`，即保存一个快照。一但我们的文件出现了错误，我们就可以用Git来回到之前的版本，接下来我们将演示这个过程。

现在我们的Git仓库里一共有三个版本，但是我们并不记得每次改动了哪些内容。我们现在可以使用`git log`命令来查看我们的版本控制系统中的历史记录：

```bash
$ git log
commit da91da7e64267eb6f293ffc8b0bde18626777d58 (HEAD -> master)
Author: Ylin07 <3280661240@qq.com>
Date:   Fri Apr 18 23:22:35 2025 +0800

    add sorry

commit 20deae4e44bc6786110d3beeda5c86ba55b75f23
Author: Ylin07 <3280661240@qq.com>
Date:   Fri Apr 18 23:18:16 2025 +0800

    add my love

commit 1428371d4f5f753c24e22e4311f6c11b3ff0656b
Author: Ylin07 <3280661240@qq.com>
Date:   Fri Apr 18 22:47:36 2025 +0800

    wrote a read file
```

`git log`命令显示从最近到最远的提交日志，如果你认为输出的信息太多，可以试试`git log --pretty=oneline`参数：

```bash
$ git log --pretty=oneline
da91da7e64267eb6f293ffc8b0bde18626777d58 (HEAD -> master) add sorry
20deae4e44bc6786110d3beeda5c86ba55b75f23 add my love
1428371d4f5f753c24e22e4311f6c11b3ff0656b wrote a read file
```

然后你会看到前面一大堆看不懂的东西，这个是`commit id`，每一次提交，都有对应的id，原理是SHA1计算

现在我们想要把`readme.txt`回到上一个版本，怎么办？首先需要知道，当前是什么版本（就是最新提交的14283...），当前的版本是`HEAD`，上一个版本是`HEAD^`,上上个版本就是`HEAD^^`，那么上n个版本就是`HEAD~n`。

现在哦我们将当前版本`add sorry`回退到上一个版本`add love`，我们使用`git reset`:

```bash
$ git reset --hard HEAD^
HEAD is now at 20deae4 add my love
```

`--hard`参数会回退到上个版本的已提交状态，`--soft`会回退到上个版本的未提交状态，`--mixed` 会回退到上个版本已添加但未提交的状态，这里我们使用`--hard`

我们可以继续回退，但是我们现在也要面临一个问题，我们没办法回去了，有办法吗？有的兄弟，有的。我们先看下`log`：

```bash
$ git log --pretty=oneline
20deae4e44bc6786110d3beeda5c86ba55b75f23 (HEAD -> master) add my love
1428371d4f5f753c24e22e4311f6c11b3ff0656b wrote a read file
```

发现之前的`commit id`没了，这咋办呢？我们使用`git reflog`查看HEAD指针的历史记录：

```bash
$ git reflog
20deae4 (HEAD -> master) HEAD@{0}: reset: moving to HEAD^
da91da7 HEAD@{1}: commit: add sorry
20deae4 (HEAD -> master) HEAD@{2}: commit: add my love
1428371 HEAD@{3}: commit (initial): wrote a read file
```

我们可以看到`da91da7`是先前版本的`commmit id`，我们使用`git reset`返回这个版本：

```bash
$ git reset --hard da91da7
HEAD is now at da91da7 add sorry
```

我们成功的回到了这个版本（这里版本号不需要写全，Git会自己去查找），就这样我们实现了git的版本控制

Git版本回退的速度特别快，你可能会好奇这是为啥，这是因为Git内部有一个指向当前版本的指针`HEAD`，当你回退版本的时候，仅仅只是把HEAD指向了前一个版本。然后顺便把工作区的文件更新了。

## 工作区和暂存区

这个概念是Git特有的一个概念，我们先对其进行解释：

+ **工作区**：实际上就是再电脑中能看到的目录
+ **版本库**：工作区中有一个隐藏的目录`.git`，这个不算工作区，而是Git的版本库。其中版本库里有很多东西，其中一个比较重要的内容就是`stage`(也叫`index`)，也就是暂存区。以及Git为我们自动创建的一个分支`master`，以及指向`master`的一个指针`HEAD`

![image.png](https://s2.loli.net/2025/04/19/H4mT3lMxiIPjfy9.png)

前面我们讲到，将文件加入Git版本库中的时候，是分两步执行的，现在我们可以解释了 ：

+ `git add` 实际上就是将文件添加到暂缓区
+ `git commit` 实际上就是将暂存区中的所有内容提交到当前分支中

创建版本库的时候，Git为我们创建了一个`mater`分支，也就是当前的`git commit`都是向`master`分支上提交更改

现在，我们带着这个思考再次进行这个过程，我们修改一下`readme.txt`并添加一个`LICENSE`文件：

```bash
$ git status
On branch master
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   readme.txt

Untracked files:
  (use "git add <file>..." to include in what will be committed)
        LICENSE

no changes added to commit (use "git add" and/or "git commit -a")
```

我们可以看到，`readme.txt`被改动的信息，还有`LICENSE`被告知没有被添加过。我们用`git add`添加后再次查看：

```bash
$ git status
On branch master
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
        new file:   LICENSE
        modified:   readme.txt
```

现在我们的暂存区变成了这样：

![image.png](https://s2.loli.net/2025/04/19/SH61oiZztQp9Dhe.png)

然后再将其提交，并查看status状态：

 ```bash
 $ git commit -m "add LICENSE & Pls"
 [master 6801700] add LICENSE & Pls
  2 files changed, 2 insertions(+)
  create mode 100644 LICENSE
 $ git status
 On branch master
 nothing to commit, working tree clean
 ```

现在的我们的版本库变成了这样，暂存区没有内容了：

![image.png](https://s2.loli.net/2025/04/19/HXcix91AYSbtFrC.png)

## 管理修改

讲到这里就不得不介绍一下，Git相较于其他版本控制系统的优越之处。这是因为Git管理的不是那文件内容，而是对于文件的修改内容。这样极大的减少了系统的管理成本。

我们尝试以下过程，以验证我们提交的是修改，而不是文件内容：

第一次修改后，将其添加至缓冲区:

```bash
$ git add readme.txt
$ git status
On branch master
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
        modified:   readme.txt
```

然后我们再进行一次修改，接着我们直接提交到仓库：

```bash
$ git commit -m "git tracks change"
[master c34bcbc] git tracks change
 1 file changed, 1 insertion(+)
$ git status
On branch master
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   readme.txt

no changes added to commit (use "git add" and/or "git commit -a")
```

但是我们发现我们的第二次修改并没有被提交，这就验证了我们的想法。我们提交的是第一次的修改，并不是最终的文件的样子，所以证明得到：提交的是修改而不是文件。

现在我们可以使用`git diff HEAD -- readme.txt`查看工作区和版本库中的最新版本的区别：

```bash
$ git diff HEAD -- readme.txt
diff --git a/readme.txt b/readme.txt
index 0394257..135beba 100644
--- a/readme.txt
+++ b/readme.txt
@@ -3,3 +3,4 @@ I love you!
 Sorry I love her more.
 Please forgive me.
 The first modify.
+The second modify.
```

我们再次将其提交，`git add` --> `git commit`

## 撤销修改

### 撤销工作区的修改

有时候我们会犯错，如果错误发现的及时我们可以手动纠正回来，但是纠正前使用`git status`你可以看到以下信息：

```bash
$ git status
On branch master
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   readme.txt

no changes added to commit (use "git add" and/or "git commit -a")
```

这里提到可以使用`git restore <file>...`恢复工作区到暂存区的状态。

```bash
$ git status
On branch master
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   readme.txt

no changes added to commit (use "git add" and/or "git commit -a")
$ git restore readme.txt
$ git status
On branch master
nothing to commit, working tree clean
```

当然你也可以进一步使用参数`git restore --source=HEAD~n -- readme.txt`来指定将工作区恢复到哪次提交的版本

### 撤回暂存区修改

当然，我们还可能遇到另外一种情况，就是我们已经将错误`git add`到了暂存区，我们在`commit`之前发现了这个错误，我们该怎么修改呢？我们使用`git status`:

```bash
$ git status
On branch master
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
        modified:   readme.txt
```

Git 提醒我们可以使用`git restore --staged <file>...`来撤销最近一次的`git add`内容。

```bash
$ git status
On branch master
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
        modified:   readme.txt

$ git restore --staged -- readme.txt
$ git status
On branch master
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   readme.txt

no changes added to commit (use "git add" and/or "git commit -a")
ylin@Ylin:~/Program/learn_git$
```

我们成功的撤销了暂存区的内容，接着我们再次撤销工作区的修改：

```bash
$ git restore readme.txt
$ git status
On branch master
nothing to commit, working tree clean
```

现在我们实现了对工作区和暂存区的撤回操作

### 版本库撤销

即版本回退，见上。

## 删除文件

在git中，删除也是一个修改操作，我们可以进行尝试。

我们向创建一个新文件`test.txt`并提交

```bash
$ git add test.txt
$ git commit -m "A test"
[master f940b04] A test
 1 file changed, 1 insertion(+)
 create mode 100644 test.txt
```

然后我将其从工作区中删除，再使用`git status`查看状态：

```bash
$ rm test.txt
$ git status
On branch master
Changes not staged for commit:
  (use "git add/rm <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        deleted:    test.txt

no changes added to commit (use "git add" and/or "git commit -a")
```

Git提醒我们这个文件被删除了，且指导我们可以使用`git rm`将其从版本库中删除，并且`git commit`:

```bash
$ git rm test.txt
rm 'test.txt'
$ git commit -m "remove git status"
[master 75303ec] remove git status
 1 file changed, 1 deletion(-)
 delete mode 100644 test.txt
```

现在文件就从版本库中删除了。

当然也有可能这个文件被你误删了，如果你上一次提交了这个文件的i需改，我们可以使用`git restore --source=<commit_hash> <file_name>`恢复到上一次提交的版本，不过还是会丢失你之后额外修改的内容。



至此，我们对于Git的基本使用就已经基本掌握了

