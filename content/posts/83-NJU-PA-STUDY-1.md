---
title: NJU_PA_STUDY(1)
date: 2025-09-27 07:37:21
series: "NJU PA"
weight: 2
---

# PA1 RTFSC

## 框架代码

由于NEMU-PA是一个很庞大的框架系统，所以要在其基础之上开发需要对框架代码进行熟悉。所以最重要的一步应该是阅读程序的源代码。在课件中，已经给出了相关代码的简要结构说明，按照标题简单理解即可：

```shell
nemu
├── configs                    # 预先提供的一些配置文件
├── include                    # 存放全局使用的头文件
│   ├── common.h               # 公用的头文件
│   ├── config                 # 配置系统生成的头文件, 用于维护配置选项更新的时间戳
│   ├── cpu
│   │   ├── cpu.h
│   │   ├── decode.h           # 译码相关
│   │   ├── difftest.h
│   │   └── ifetch.h           # 取指相关
│   ├── debug.h                # 一些方便调试用的宏
│   ├── device                 # 设备相关
│   ├── difftest-def.h
│   ├── generated
│   │   └── autoconf.h         # 配置系统生成的头文件, 用于根据配置信息定义相关的宏
│   ├── isa.h                  # ISA相关
│   ├── macro.h                # 一些方便的宏定义
│   ├── memory                 # 访问内存相关
│   └── utils.h
├── Kconfig                    # 配置信息管理的规则
├── Makefile                   # Makefile构建脚本
├── README.md
├── resource                   # 一些辅助资源
├── scripts                    # Makefile构建脚本
│   ├── build.mk
│   ├── config.mk
│   ├── git.mk                 # git版本控制相关
│   └── native.mk
├── src                        # 源文件
│   ├── cpu
│   │   └── cpu-exec.c         # 指令执行的主循环
│   ├── device                 # 设备相关
│   ├── engine
│   │   └── interpreter        # 解释器的实现
│   ├── filelist.mk
│   ├── isa                    # ISA相关的实现
│   │   ├── mips32
│   │   ├── riscv32
│   │   ├── riscv64
│   │   └── x86
│   ├── memory                 # 内存访问的实现
│   ├── monitor
│   │   ├── monitor.c
│   │   └── sdb                # 简易调试器
│   │       ├── expr.c         # 表达式求值的实现
│   │       ├── sdb.c          # 简易调试器的命令处理
│   │       └── watchpoint.c   # 监视点的实现
│   ├── nemu-main.c            # 你知道的...
│   └── utils                  # 一些公共的功能
│       ├── log.c              # 日志文件相关
│       ├── rand.c
│       ├── state.c
│       └── timer.c
└── tools                      # 一些工具
    ├── fixdep                 # 依赖修复, 配合配置系统进行使用
    ├── gen-expr
    ├── kconfig                # 配置系统
    ├── kvm-diff
    ├── qemu-diff
    └── spike-diff
```

为了支持不同的ISA形式。框架代码将NEMU分成两部分：ISA的相关实现和ISA无关的框架代码。其中不同的ISA被存放在`src/isa`目录下，用于提供接口，其余部分框架则是相同的实现。这里我们选择RISCV作为我们的ISA，现在我们就可以对整个框架代码进行分析了。

## 配置系统和项目构建

系统的主要配置文件存放在主目录下的`Kconfig`文件中，当我们运行`make memuconfig`时，会弹出一个可视化的编辑界面，程序会将我们的选择对应的添加到`include\generate\autoconf.h`中，用于编译时设置。从而实现对框架代码的简易配置。

对于更复杂的过程，涉及到`makefile`的编写，这里暂时忽略。

## 准备第一个客户应用

NEMU作为一个模拟的计算机系统，主要的功能就是运行客户程序。我们可以从头观察NEMU的项目框架，来查看，NEMU是怎么进行初始化，并且将客户应用加载到内存中运行的。

首先是进入`nemu-main.c`中，可以看到形如`CONFIG_XX`的宏定义字样，我们可以在`autoconf.h`中找到相关的宏定义，根据部分宏的配置，可能会编译时忽略或是开启部分功能。

NEMU的框架代码主要通过函数进行包装，进入`nemu-main.c`中，首先执行的是`init_moniter()`,步进程序可以看到monitor的初始化过程，对于`mem`和`seed`都是简单的设置，可以之间看源代码

其中`init_isa()`的代码比较特殊，也比较关键：

```c
static void restart() {
  /* Set the initial program counter. */
  cpu.pc = RESET_VECTOR;

  /* The zero register is always 0. */
  cpu.gpr[0] = 0;
}
void init_isa() {
  /* Load built-in image. */
  memcpy(guest_to_host(RESET_VECTOR), img, sizeof(img));
  /* Initialize this virtual computer system. */
  restart();
}
```

程序首先将`img`（这里是初始程序，加载到主机的起始地址），具体的内容可以在`isa\risc32\init.c`中查看看，`restart()`的作用是将CPU复位成初始状态，这里主要是将pc置0，并将riscv的第一个寄存器设置为0，作为零寄存器。

通过查看`memory`目录我们可以知道，NEMU为客户计算机提供了`128MB`的物理内存，同时我们将客户程序读入到内存的固定内存位置`RESET_VECTOR`。

在这里我们需要分清楚主机和客户机的区别，主机就是运行NEMU的物理计算机，客户机就是在NEMU上运行的计算机程序。我们使用`guest_to_host()`和`host_to_guest()`进行主机和客户机地址的相互转换。`guest_to_host()`将我们在客户机的物理地址转换成在NEMU内存中的数组地址，`host_to_guest()`则将内存中的数组地址转换成客户机的物理地址。

我们可以在`include\memory\paddr.h`中找到对`RESET_VECTOR`的定义，由于这里我们没有设置`CONFIG_PC_RESET_OFFSET`所以内存的加载从`pmem[0]`开始。

接着程序调用`load_image()`用于向内存中加载程序，如果没有给出img参数，则NEMU使用内置的初始化程序，我们可以在`isa/risc32/init.c`中看到。

然后程序调用`welcome()`,我们编译运行时看到的信息就是来自这里。

## 运行第一个客户运用

在monitor完成初始化之后，`nemu-main.c`会进入下一个程序`engine_start`中的`sdb_mainloop()`，并输出提示符指示输入：

```shell
(nemu)
```

在`src\monitor\sdb\sdb.c`中，程序预设了一个`cnd_table`，设置在sdb中支持的指令：

```c
cmd_table [] = {
  { "help", "Display information about all supported commands", cmd_help },
  { "c", "Continue the execution of the program", cmd_c },
  { "q", "Exit NEMU", cmd_q },

  /* TODO: Add more commands */

};
```

对于参数的处理和选择执行可以通过阅读`sdb_mainloop`理解，这里我们主要将注意力放到`cmd_c()`的调用函数`cpu_exec()`上，它是我们模拟器运行程序的cpu执行的核心，这里传入了一个参数`-1`但由于是`uint64_t`表示，所以实际上的数值是`0xFFFFFFFFFFFFFFFF`，即持续执行，这里我们进一步的步入追踪，最终查看到`exec_once()`，他负责将pc设置成下一条指令执行的位置。

现在NEMU会不断的进行执行，首先它执行的便是我们的内置程序：

```c
static const uint32_t img [] = {
  0x00000297,  // auipc t0,0
  0x00028823,  // sb  zero,16(t0)
  0x0102c503,  // lbu a0,16(t0)
  0x00100073,  // ebreak (used as nemu_trap)
  0xdeadbeef,  // some data
};
```

在NEMU中我们将`ebreak`的语义设置成，接受a0的数据作为退出状态。同时为了检测客户程序的退出，设置了以下三种状态：

- `HIT GOOD TRAP` - 客户程序正确地结束执行
- `HIT BAD TRAP` - 客户程序错误地结束执行
- `ABORT` - 客户程序意外终止, 并未结束执行

我们在nemu中使用`c`就可以获得以下输出：

```shell
nemu: HIT GOOD TRAP at pc = 0x8000000c
```

即nemu的客户程序在`pc = 0x8000000c`处成功退出。退出`cpu_exec()`之后，我们再使用`q`退出nemu程序。

## 优美的退出

我们运行NEMU后直接使用`q`会产生报错：

```shell
ylin@Ylin:~/ics2025/nemu$ make run
/home/ylin/ics2025/nemu/build/riscv32-nemu-interpreter --log=/home/ylin/ics2025/nemu/build/nemu-log.txt
[src/utils/log.c:30 init_log] Log is written to /home/ylin/ics2025/nemu/build/nemu-log.txt
[src/memory/paddr.c:50 init_mem] physical memory area [0x80000000, 0x87ffffff]
[src/monitor/monitor.c:51 load_img] No image is given. Use the default build-in image.
[src/monitor/monitor.c:28 welcome] Trace: ON
[src/monitor/monitor.c:29 welcome] If trace is enabled, a log file will be generated to record the trace. This may lead to a large log file. If it is not necessary, you can disable it in menuconfig
[src/monitor/monitor.c:32 welcome] Build time: 20:11:21, Sep 26 2025
Welcome to riscv32-NEMU!
For help, type "help"
(nemu) q
make: *** [/home/ylin/ics2025/nemu/scripts/native.mk:38: run] Error 1
```

我们需要找出原因并解决这个问题。

这是`cmd_q`的源代码：

```c
static int cmd_q(char *args) {
  return -1;
}
```

我们输入q后会因为`sdb_mainloop`的判断逻辑退出到`nemu_main`执行`is_exit_status_bad()`:

```C
int is_exit_status_bad() {
  int good = (nemu_state.state == NEMU_END && nemu_state.halt_ret == 0) ||
    (nemu_state.state == NEMU_QUIT);
  return !good;
}
```

程序会检测nemu的状态而决定以什么情况退出，我们之前的报错则是因为，我们没有为NEMU设置任何状态，NEMU以默认状态退出，因此返回错误。想要优雅的退出，我们只需要再退出前设置好NEMU的状态。因此我们对`cmd_q()`函数进行重写

```c
static int cmd_q(char *args) {
  nemu_state.state = NEMU_QUIT;
  return -1;
}
```

