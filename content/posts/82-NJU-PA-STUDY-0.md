---
title: NJU_PA_STUDY(0)
date: 2025-09-26 19:33:39
series: "NJU PA"
weight: 1
---

这个学期抽取一部分课余时间用来完成NJU的PA实验，争取能做多少做多少。

第一篇先从环境配置开始，这里我使用的程序环境是WSL+Vscode。

# PA0 Getting Source Code For PAs

## 拉取源码

由于我的git环境已经配置好了，所以直接在我的主目录下面`clone`文件内容就行了：

```shell
git clone -b 2025 git@github.com:NJU-ProjectN/ics-pa.git ics2025
```

然后`cd ics2025`，以后这个目录就是项目的工程目录了。由于我不需要追踪进度，所以就不用提交信息啥的，直接进行初始化就行了：

```shell
git branch -m master
bash init.sh nemu
```

为了方便子项目的编译，`init.sh`会向环境变量中添加部分环境变量，这里可以通过

```shell
echo $NEMU_HOME
cd $NEMU_HOME
```

来验证环境变量是否正确设置，如果没有的话，使用`source /.bashrc`来激活cd

## 分支创建

现在我们需要创建一个新的分支，作为`pa0`的工作分支，之后每个阶段的PA都会单独设置一个分支，再进行合并，我们可以使用`git branch`来查看现有分支，然后我们：

```shell
❯ git checkout -b pa0
Switched to a new branch 'pa0'
❯ git branch
  master
* pa0
```

从而创建并跳转到一个新的分支上，然后我们修改一下makefile（因为我们不需要跟踪进度）

## 编译运行NEMU

通过`make menuconfig`进行文件的编译：

```shell
ylin@Ylin:~/ics2025/nemu$ make menuconfig
/home/ylin/ics2025/nemu/scripts/config.mk:20: Warning: .config does not exist!
/home/ylin/ics2025/nemu/scripts/config.mk:21: To build the project, first run 'make menuconfig'.
+ CC confdata.c
+ CC expr.c
+ CC preprocess.c
+ CC symbol.c
+ CC util.c
+ YACC build/parser.tab.h
+ LEX build/lexer.lex.c
+ CC build/lexer.lex.c
+ CC build/parser.tab.c
+ CC mconf.c
+ CC lxdialog/inputbox.c
+ CC lxdialog/yesno.c
+ CC lxdialog/textbox.c
+ CC lxdialog/checklist.c
+ CC lxdialog/util.c
+ CC lxdialog/menubox.c
+ LD /home/ylin/ics2025/nemu/tools/kconfig/build/mconf
+ CC confdata.c
+ CC expr.c
+ CC preprocess.c
+ CC symbol.c
+ CC util.c
+ CC build/lexer.lex.c
+ CC build/parser.tab.c
+ CC conf.c
+ LD /home/ylin/ics2025/nemu/tools/kconfig/build/conf
+ CC fixdep.c
+ LD /home/ylin/ics2025/nemu/tools/fixdep/build/fixdep


*** End of the configuration.
*** Execute 'make' to start the build or try 'make help'.
```

实际上这是再设置`make`的配置文件，会跳出一个可视化界面，按照自己的需求选择即可，这里我选择了DEBUG的信息。第一次编译的时候有报错，缺少了几个程序，安装即可正常运行。然后`make`即可。如果编译有误，可以通过`make clean`删除内容再进行编译。

现在可以通过`make run`来运行这个项目，可以得到：

```shell
ylin@Ylin:~/ics2025/nemu$ make run
/home/ylin/ics2025/nemu/build/riscv32-nemu-interpreter --log=/home/ylin/ics2025/nemu/build/nemu-log.txt
[src/utils/log.c:30 init_log] Log is written to /home/ylin/ics2025/nemu/build/nemu-log.txt
[src/memory/paddr.c:50 init_mem] physical memory area [0x80000000, 0x87ffffff]
[src/monitor/monitor.c:51 load_img] No image is given. Use the default build-in image.
[src/monitor/monitor.c:28 welcome] Trace: ON
[src/monitor/monitor.c:29 welcome] If trace is enabled, a log file will be generated to record the trace. This may lead to a large log file. If it is not necessary, you can disable it in menuconfig
[src/monitor/monitor.c:32 welcome] Build time: 20:05:51, Sep 26 2025
Welcome to riscv32-NEMU!
For help, type "help"
[src/monitor/monitor.c:35 welcome] Exercise: Please remove me in the source code and compile NEMU again.
riscv32-nemu-interpreter: src/monitor/monitor.c:36: welcome: Assertion `0' failed.
make: *** [/home/ylin/ics2025/nemu/scripts/native.mk:38: run] Aborted (core dumped)
```

这里可以看到一段报错`riscv32-nemu-interpreter: src/monitor/monitor.c:36: welcome: Assertion `0' failed.`，这个是实验的第一个简单测试，我们到源码处，注释掉指定的错误语句即可：

```c
static void welcome() {
  Log("Trace: %s", MUXDEF(CONFIG_TRACE, ANSI_FMT("ON", ANSI_FG_GREEN), ANSI_FMT("OFF", ANSI_FG_RED)));
  IFDEF(CONFIG_TRACE, Log("If trace is enabled, a log file will be generated "
        "to record the trace. This may lead to a large log file. "
        "If it is not necessary, you can disable it in menuconfig"));
  Log("Build time: %s, %s", __TIME__, __DATE__);
  printf("Welcome to %s-NEMU!\n", ANSI_FMT(str(__GUEST_ISA__), ANSI_FG_YELLOW ANSI_BG_RED));
  printf("For help, type \"help\"\n");
 // Log("Exercise: Please remove me in the source code and compile NEMU again.");
 // assert(0);
}
```

这里设置了一个断言，让我们再运行时必定停止在这里。

现在我们可以正常的使用我们的程序了，同时我们也可以使用`make gdb`来进行对NEMU的调试。

# PA1 开天辟地的篇章

计算机的本质就是状态机，从CPU出发，我们可以简单的将CPU的行为总结为

```c
while (1) {
  从PC指示的存储器位置取出指令;
  执行指令;
  更新PC;
}
```

我们的计算机实际上是从一个初始状态开始（就是硬件所指定的通电后的复位状态），计算机有一个程序计数器，始终指向下一段要执行的指令地址，当我们从地址取出要执行的指令，当我们对指令进行执行。程序的状态就发生了改变，我们称之为状态的迁移。

所以计算机的一切行为对我们而言都是可溯源的，我们只需要理解状态机的规则，与进行的动作，我们就可以还原任意时刻计算机内存的状态。我们就可以知道每一个动作背后的原理和现象。

PA实验则是通过对NEMU的设计，还原和理解真实计算机的各种功能和实现。所以对于计算机系统的学习是十分有帮助的。希望自己能坚持做下去吧。最近还挺忙的，但还是要加油。

