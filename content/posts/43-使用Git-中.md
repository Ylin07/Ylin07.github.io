---
title: 使用Git(中)
date: 2025-04-19 16:52:27
series: "工具链学习"
weight: 2
---

上一篇中学习了基本的本地的版本控制，现在进一步的学习Git的使用。

# 远程仓库

现在我们需要找一个网站用来为我们提供Git仓库托管服务，这个网站叫做[Github](https://github.com/)，这个网站为我们提供了Git仓库的托管服务，不过我们首先需要注册一个账号，这里我已经搞完了。

本地的Git仓库和Github仓库之间的传输时通过SSH设置的，所以我们需要设置：

**创建SSH Key**：这个我在本机上已经搞过了，这次在WSL上也搞一次，输入指令

```bash
$ ssh-keygen -t rsa -C "youremail@example.com"
```

然后你就会看到这个界面：

```bash
$ ssh-keygen -t rsa -C "3280661240@qq.com"
Generating public/private rsa key pair.
Enter file in which to save the key (/home/ylin/.ssh/id_rsa):
Created directory '/home/ylin/.ssh'.
Enter passphrase (empty for no passphrase):
Enter same passphrase again:
Your identification has been saved in /home/ylin/.ssh/id_rsa
Your public key has been saved in /home/ylin/.ssh/id_rsa.pub
The key fingerprint is:
SHA256:7Y9JTYk3YxznFF9ODtZ5xak0GKB5t4Llw1eK/HRabBw 3280661240@qq.com
The key's randomart image is:
+---[RSA 3072]----+
|         ...o +oB|
|        o  . + X=|
|       o o .oE= =|
|        B.oo*B.  |
|       .SBo=O*.  |
|         .*==o   |
|          oo.    |
|         . +     |
|          o .    |
+----[SHA256]-----+
```

在`Enter passphrase`处可以输入你的密码（用于生成私钥）

**配置公钥文件**：获取公钥的内容

```bash
$ cat id_rsa.pub
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCg9NIo/g5YB3ghujWZyhqN4XL4Zu4lowZh66OefI0jwdqJ6LRPcxQfmM7zw6EKK6HZID0OtrkfP7Rohcwo4D1rZi4R6I6V8hXSsM3OxP8NlDo4OvG6sheJS4SWNF5ajjjAzZaFYxPvtR7zvVaw0640w6iAOKlc55hNvFf35a647W0o3OzCK/B+/knduY4WYdn7ApBBPM8Ktwf4BHVS5098PpJeu8w4SZIMe59O4iRbpICrnmeKaPkf/U3bLqvhOAwFkyW7W/ql6B7uh7hzbPmTbKNvT12Zykk8JcbJv5Wd5PVVULfFNbmVqckrdJ+xNs6RqVfUFG0cuhI7b16WGcoNWnCW...
```

然后复制内容到这里：

![image.png](https://s2.loli.net/2025/04/19/JCPSHupxeO3KaNq.png)

![image.png](https://s2.loli.net/2025/04/19/cUw32NdMIkCE4Ri.png)

现在我们就添加成功啦。

SSH Key的作用是，Github需要识别处你推送的提交是你的推送的，而不是别人冒充的。同时由于RSA加密的特性，公钥是可以公开的，但是私钥是由自己保管的，从而确保了加密的安全性。在此基础上，我们可以开始远程仓库的使用了。

## 添加远程库

现在我们在本地已经有了一个版本库，我们再到Github创建一个仓库，让这两个仓库进行远程同步。这样Github上的仓库既可以作为备份，也可以让其他人通过仓库来协作。

首先在Github上面创建一个新的仓库：

![image.png](https://s2.loli.net/2025/04/19/j2Oso7LveGFgB4K.png)

一个Github仓库就这样建好了，现在我们将其和我们的本地仓库关联起来。根据Github下面的提示，我们在本地的仓库里面运行这些命令：

```bash
$ git remote add origin git@github.com:Ylin07/Learn_Git.git
```

添加后，远程库的名字就是`origin`，这是Git的默认叫法。下一步，我们将本地库的所有内容推送到远程库上：

```bash
$ git push -u origin master
The authenticity of host 'github.com (140.82.112.4)' can't be established.
ED25519 key fingerprint is SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added 'github.com' (ED25519) to the list of known hosts.
Enter passphrase for key '/home/ylin/.ssh/id_rsa':
------------------------------------
Enumerating objects: 22, done.
Counting objects: 100% (22/22), done.
Delta compression using up to 32 threads
Compressing objects: 100% (14/14), done.
Writing objects: 100% (22/22), 1.72 KiB | 1.72 MiB/s, done.
Total 22 (delta 3), reused 0 (delta 0), pack-reused 0
remote: Resolving deltas: 100% (3/3), done.
To github.com:Ylin07/Learn_Git.git
 * [new branch]      master -> master
branch 'master' set up to track 'origin/master'.
```

其中由于，这是第一次关联，我们需要验证公钥指纹，然后将身份添加到`~/.ssh/known_hosts`中，同时需要输入密钥验证，这里我用分割线把这一部分区分出来。下面则是我们将本地仓库推送上去的信息。

由于远程库是空的，我们第一次推送`master`分支，使用了`-u`参数，Git不但会把本地的`master`分支推送上去，还会把本地的`master`和远程的`master`分支关联起来，这样在之后的推送和拉去就可以简化命令。

然后我们就可以在Github页面中看到远程库的内容和本地是一样的

![image.png](https://s2.loli.net/2025/04/19/RTJELq8kGOVxznZ.png)

从现在开始，只要本地作了提交，就可以通过命令：

```bash
$ git push origin master
```

把本地的`master`分支的最新修改推送到GIthub，现在我们就有了完整的分布式版本库。

### 删除远程库

如果添加的时候地址写错了，或者是想删除远程库，可以使用`git remote rm <name>`命令。使用前，我们先使用`git remote -v`来查看远程库的信息：

```bash
$ git remote -v
origin  git@github.com:Ylin07/Learn_Git.git (fetch)
origin  git@github.com:Ylin07/Learn_Git.git (push)
```

然后根据名字删除，比如删除`origin`:

```bash
$ git remote rm origin
```

此处的删除实际上是解除了本地和远程的关联状态，并不是删除了远程库。远程库本身并没有改动，如果想要删除远程库，应该到Github后台删除。

## 克隆远程仓库

上次我们讲了现有本地库，再有远程库的时候，如何关联远程库。现在我们从头开始，假如我们从远程库开始克隆该怎么做呢？

我们把这个网址的项目给`clone`下来[8086]([Rexicon226/8086: A i8086 emulator written in CPP](https://github.com/Rexicon226/8086))

```bash
$ git clone git@github.com:Rexicon226/8086.git
Cloning into '8086'...
Enter passphrase for key '/home/ylin/.ssh/id_rsa':
remote: Enumerating objects: 31, done.
remote: Counting objects: 100% (31/31), done.
remote: Compressing objects: 100% (26/26), done.
remote: Total 31 (delta 6), reused 27 (delta 4), pack-reused 0 (from 0)
Receiving objects: 100% (31/31), 6.61 KiB | 1.65 MiB/s, done.
Resolving deltas: 100% (6/6), done.
```

OK,然后看看文件夹，已经被远程库的内容已经被拉下来了：

```bash
$ cd 8086
$ ls
bootloader  CMakeLists.txt  emulator  README.md
```

当然我们还可以使用其他的方法，比如https协议，只不过这个对网络环境有一定的要求。

```bash
git clone https://github.com/Rexicon226/8086.git
```

现在我们就掌握了对于远程仓库的基本操作啦。

# 分支管理

当你和别人共同开发一个项目时，你们可以各自创建一个分支，不同的分支拥有自己的进度，互不打扰。再各自的项目完成之后，再将分支合并，从而实现同时开发的效果，这就是Git的分支管理功能。

## 创建与合并分支

在版本回退中我们知道，Git把提交串成一条时间线，这个时间线就是一个分支。当目前为止，我们只有一个分支，这个分支就叫主分支`master`，而其中的`HEAD`指针并不直接指向提交的，它指向的是`master`，而`master`指向的是提交，所以我们说`HEAD`指向的是当前的分支。

一开始的时候，`master`分支是一条线，Git用`master`指向最新的提交，再用`HEAD`指向`master`，就能确定当前分支，以及当前分支的提交点：

```text
       HEAD --> master
                  |
[   ]-->[   ]-->[   ]
```

每次提交`master`分支就向前移动一步，这样随这不断的提交，`master`分支也会越来越长。

当我们创建新的分支`new`时，Git新建了一个指针叫`new`，指向`master`相同的提交，再把`HEAD`指向`new`，就表示当前分支在`new`上：

```TEXT
               master
                  |
[   ]-->[   ]-->[   ]
                  |
        HEAD --> new
```

由此可以看出，Git创建一个分支很快，实际上就是增加了一个`new`指针，然后改变一下`HEAD`的指向

不过接下来，对于工作区的修改与提交就是针对`new`了，比如提交一次之后会变成这样：

```text
                master
                  |
[   ]-->[   ]-->[   ]-->[   ]
                          |
                HEAD --> new
```

假如我们在分支`new`上的工作完成了，就可以把`new`合并到`master`上。Git怎么合并呢，实际上就是将`master`移动到和`new`指向相同的版本上，然后将`HEAD`指向`master`

```text
               HEAD --> master
                          |
[   ]-->[   ]-->[   ]-->[   ]
                          |
                         new
```

合并完成之后，甚至可以删除`new`分支，我们直接将其`new`指针删除既可，这样就只剩下一个`mater`分支：

```text
               HEAD --> master
                          |
[   ]-->[   ]-->[   ]-->[   ]
```

这样相当于用分支的功能完成了提交，这样更加安全。

现在我们来进行尝试：

首先创建一个`new`分支，然后切换过去

```bash
$ git checkout -b new
Switched to a new branch 'new'
```

`git checkout`命令加上`-b`参数表示创建并切换，相当于以下两个命令的组合

```bash
$ git branch new
$ git branch
* master
  new
$ git checkout new
Switched to branch 'new'
```

`git branch`命令会列出所有的分支，当前分支前会有一个`*`号。然后我们在`new`分支上修改后正常提交：

```bash
$ git add readme.txt
$ git commit -m "branch test"
[new 4c8096e] branch test
 1 file changed, 1 insertion(+)
```

现在`dev`的分支工作完成，我们切换回`master`分支，然后再查看`readme.txt`：

```bash
$ git checkout master
Switched to branch 'master'
```

然后我们打开`readme.txt`发现原来的修改怎么不见了。因为刚刚提交的修改在`new`分支上，此时`master`分支的提交点并没有变：

```text
       HEAD --> master
                  |
[   ]-->[   ]-->[   ]-->[   ]
                          |
                         new
```

现在我们将`new`分支的工作成果合并到`master`分支上：

```bash
$ git merge new
Updating f940b04..4c8096e
Fast-forward
 readme.txt | 1 +
 1 file changed, 1 insertion(+)
```

`git merge`命令用于合并指定分支到当前分支。合并后，再查看`readme.txt`的内容，可以看到现在和最新提交是一样的了。

注意到上面的`Fast-forward`信息，它的意思是这次合并是“快进模式”，也就是把`master`指向`dev`的当前提交，所以很快

合并之后，我们将`new`分支删除，并查看`branch`，只剩下了`master`：

```bash
$ git branch -d new
Deleted branch new (was 4c8096e).
$ git branch
* master
```

由于创建，合并和删除分支非常快，所以Git更加鼓励使用分支完成任务，然后再删除分支，这样比直接在`master`上工作的效果是一样的，但是过程更加的安全。

### switch

切换分支，除了使用`git checkout <branch>`，还可以使用`switch`来实现：

+ 创建并切换到新得`new`分支，可以用：`git switch -c new`
+ 直接切换到已有得`master`分支，可以用：`git switch master`

## 解决冲突

有时候合并也会遇到各种冲突，现在我们手动制造一个冲突，我们创建一个新的分支`n1`:

```bash
$ git switch -c n1
Switched to a new branch 'n1'
```

最后一行加个`01234`，然后提交修改

```bash
$ git add readme.txt
$ git commit -m "01234"
[n1 6d5f5d1] 01234
 1 file changed, 1 insertion(+)
```

然后切换回`master`分支，然后对`readme.txt`做不一样的修改，并提交：
```bash
$ git add readme.txt
$ git commit -m "56789"
[master 38fe2c0] 56789
 1 file changed, 1 insertion(+)
```

现在`master`和`n1`分支各自都分别有新的提交：

```bash
                  +-->[   ] <-- master <-- HEAD
                  |		
[   ]-->[   ]-->[   ]
                  |
                  +-->[   ] <-- n1
```

这种情况下，Git没办法快速合并，只能视图把各自的修改合并起来：

```bash
$ git merge n1
Auto-merging readme.txt
CONFLICT (content): Merge conflict in readme.txt
Automatic merge failed; fix conflicts and then commit the result.
```

结果提示了冲突，我们需要手动解决冲突后再提交，我们可以用`git status`告诉我们冲突的文件：

```bash
$ git status
On branch master
You have unmerged paths.
  (fix conflicts and run "git commit")
  (use "git merge --abort" to abort the merge)

Unmerged paths:
  (use "git add <file>..." to mark resolution)
        both modified:   readme.txt

no changes added to commit (use "git add" and/or "git commit -a")
```

我们打开`readme.txt`看看：

```text
Hello Git!!!
I love you!
Sorry I love her more.
Please forgive me.
The first modify.
The second modify.
Test new branch.
<<<<<<< HEAD
56789
=======
01234
>>>>>>> n1
```

Git 用`<<<<<<<`,`=======`,`>>>>>>>`标记出不同分支的内容，我们修改后再保存

我们修改之后再保存：

```text
Hello Git!!!
I love you!
Sorry I love her more.
Please forgive me.
The first modify.
The second modify.
Test new branch.
00000
```

再提交：

```bash
$ git add readme.txt
$ git commit -m "conflict mixed"
[master f17b017] conflict mixed
```

现在我们的版本库变成了这样：

```text
                  +-->[   ]-->[   ] <-- master <-- HEAD
                  |              ^	
[   ]-->[   ]-->[   ]            |
                  |              |	
           n1 --> +-->[   ] ———— +
						 	 
```

我们可以用带参数的`got log`可视化的看到我们分支的合并情况：

```bash

$ git log --graph --pretty=oneline --abbrev-commit
*   f17b017 (HEAD -> master) conflict mixed
|\
| * 6d5f5d1 (n1) 01234
* | 38fe2c0 56789
|/
* 4c8096e branch test
* f940b04 A test
* 4c16e7a The last patch
* c34bcbc git tracks change

* 6801700 add LICENSE & Pls
* da91da7 add sorry
* 20deae4 add my love
* 1428371 wrote a read file
```

解释以下标签的意思：

+ `--graph`:以字符可视化的方式打印分支流程
+ `--pretty=oneline`：以一行压缩打印，不显示id之外的信息
+ `--abbrev-commit`：简略id信息，只显示一部分

合并之后，我们删除`n1`分支：

```bash
$ git branch -d n1
Deleted branch n1 (was 6d5f5d1).
$ git branch
* master
```

## 分支管理策略

通常合并分支时，Git会优先使用`Fast forward`的模式，但这种模式下，删除分支，会丢失分支信息

如果我们要强制禁用`Fast forward`模式，Git就会在merge时生成一个新的commit，这样就从分支历史上可以看出分支信息，下面我们尝试一个`--no-ff`方法的`git merge`：

首先创建一个分支，并修改内容，然后提交修改：

```bash
$ git switch -c dev
Switched to a new branch 'dev'
$ ni readme.txt
$ git add readme.txt
$ git commit -m "try new merge"
[dev f769ab7] try new merge
 1 file changed, 1 insertion(+), 1 deletion(-)
```

然后我们切换回`master`并使用`--no-ff`参数，以禁用`Fast forward`:
``` bash
$ git switch master
Switched to branch 'master'
$ git merge --no-ff -m "merge with no-ff" dev
Merge made by the 'ort' strategy.
 readme.txt | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

因为本次合并会产生新的commit，所以加上`-m`参数，把commit描述加进去。然后用`git log`查看历史：

```bash
$ git log --graph --pretty=oneline --abbrev-com
mit
*   806dc97 (HEAD -> master) merge with no-ff
|\
| * f769ab7 (dev) try new merge
|/
*   f17b017 conflict mixed
...
```

可以看到不用`Fast forward`模式，merge后就像这样：

```text
                  +-->[   ] <-- master <-- HEAD
                  |     ^	
[   ]-->[   ]-->[   ]   |	
                  |     |	
                  +-->[   ] <-- n1
```

### 分支策略

在实际开发种，我们应该明确几个基本原则，进行分支管理：

+ 首先`master`分支应该稳定的，仅用来发布新版本，不能在上面干活
+ 平时应该在`dev`分支上干活，只有特定版本可以发布时，我们再将`dev`和`master`分支进行合并
+ 每个人又自己的分支，当完成特定功能时，再向`dev`分支合并

因此，团队协作更像是这样的：

![image.png](https://s2.loli.net/2025/04/20/Pw8YGO5dK2yT4NS.png)

