---
title: NJU_PA_STUDY(2)
date: 2025-09-28 09:34:21
series: "NJU PA"
weight: 3
---
NEME是一个用于执行其他用户程序的虚拟计算机，对于运行在NEMU中的应用程序，外部的调试器难以获取其详细的信息，往往需要对引用程序内部下断点的方法来观察程序运行。

但是对于NEMU而言，应用程序的状态是可见的，因此我们需要一个简单有效的方法来观察并调试应用程序的内部状态，所以我们需要设计简易调试器，作为NEMU的基础设施，方便日后的进一步处理。

# PA1 基础设施

我们需要在monitor中实现一个简单的sdb。相关的框架代码存放在`src\monitor\sdb`中，我们可以在cmd_table中查看目前已有的指令。

```c
static struct {
  const char *name;
  const char *description;
  int (*handler) (char *);
} cmd_table [] = {
  { "help", "Display information about all supported commands", cmd_help },
  { "c", "Continue the execution of the program", cmd_c },
  { "q", "Exit NEMU", cmd_q },
  /* TODO: Add more commands */
};
```

在PA1中我们要实现的功能还有：

![image.png](https://s2.loli.net/2025/09/28/dQbZXDc6zxEKeNS.png)

今天则从最基本的三个功能开始实现：

+ 单步执行
+ 打印寄存器状态
+ 扫描内存状态

## 解析命令

NEMU通过<readline>库对命令行输入进行处理。我们可以在函数`rl_gets()`中看到对`readline()`函数的包装。然后在`sdb_mainloop()`中通过调用其获取，命令行内容。后续对获取的命令行内容进行解析：

```c
for (char *str; (str = rl_gets()) != NULL; ) {
    char *str_end = str + strlen(str);

    /* extract the first token as the command */
    char *cmd = strtok(str, " ");
    if (cmd == NULL) { continue; }

    /* treat the remaining string as the arguments,
     * which may need further parsing
     */
    char *args = cmd + strlen(cmd) + 1;
    if (args >= str_end) {
      args = NULL;
}
```

这里程序将命令行内容解析为命令`cmd`和命令行参数`args`，我们接受cmd和args的指针，然后根据cmd调用对应的指令。不过这里需要注意。对于多参数的指令，我们需要对`args`进行额外的处理。

## 单步执行

现在我们开始进行单步执行的操作，首先我们需要向`cmd_table`中添加我们的指令和对应的处理函数：

```c
{ "si", "si [N]", cmd_si},
```

然后对于`si`的执行逻辑我们写在处理函数`cmd_si`中。

对于单步执行的实现，我们希望CPU一次只执行一条指令，我们自然会想到先前的负责CPU执行的函数`cpu_exec()`，我们可以参考`c/continue`的实现来完成。

```c
static int cmd_si(char *args) {
  if(args==NULL){
    cpu_exec(1);
    return 0;
  }
  int step = strtol(args,NULL,0);
  cpu_exec(step);
  return 0;
}
```

当使用`si`是默认步进一条指令，当给出指定参数时，不仅指定的步数。

## 显示寄存器

寄存器和ISA架构是相关的，所以框架中为我们在`src/isa/$ISA/reg.c`中设置了相应的接口`isa_regs_display()`，我们只需要完善这个接口。然后在处理函数中调用它就好了。

我们先向`cmd_tale`中添加对应的功能:

```c
{ "info", "info [r/w]", cmd_info},
```

使用`cmd_info()`作为命令的处理函数。

```c
static int cmd_info(char* args){
  if(strncmp(args,"r\0",1)){
    printf("Unknown arguments '%s'\n",args);
    return 0;
  }else{
    isa_reg_display();
    return 0;
  }
}
```

由于之后还要拓展所以需要对`info`的参数进行匹配。这里我们调用了框架提供的接口进行使用`isa_regs_display()`:

```c
void isa_reg_display() {
  for(int i=0;i<32;i+=4){
    printf("[%s]\t0x%08x |\t",regs[i],cpu.gpr[i]);
    printf("[%s]\t0x%08x |\t",regs[i+1],cpu.gpr[i+1]);
    printf("[%s]\t0x%08x |\t",regs[i+2],cpu.gpr[i+2]);
    printf("[%s]\t0x%08x\n",regs[i+3],cpu.gpr[i+3]);
  }
}
```

我们通过对应的格式打印`cpu`结构中的通用寄存器的值即可。

## 扫描内存

由于我们还没有实现对表达式的求值和解析，所以在指定内存时，我们暂时只支持十六进制。至于扫描内存，我们只需要从指定的位置起始，使用内存接口打印指定长度的字节即可。我们可以在`src\memory\vaddr.c`中找到我们可使用的接口。

由于我们的应用程序是运行在虚拟空间中的，所以我们使用的是虚拟内存读取`vaddr_read()`。现在我们可以尝试开始实现这个功能，首先我们需要向`cmd_table()`，添加功能函数：

```c
  { "x", "x [N] EXPR", cmd_x}
```

由于这一部分我们需要使用两个参数，所以我们还需要对`args`进行预处理，用于为内存扫描提供参数

```c
  char* arg1=strtok(args, " ");
  if(arg1==NULL){
    printf("No argument1 , the format 'x [N] EXPR'\n");
    return 0;
  }else{
    len = strtol(arg1,NULL,0);
  }
  char* arg2=strtok(NULL, " ");
  if(arg2==NULL){
    printf("No argument2 , the format 'x [N] EXPR'\n");
    return 0;
  }else{
    addr = strtol(arg2,NULL,0);
  }
```

这里我们使用`strtol`来划分参数，然后使用strtol将参数转换为对应的数值，作为接口的参数，然后我们就可以通过访问接口，遍历打印指定位置的内存数数据了：

```c
static int cmd_x(char* args){
  int len;
  int addr;
  char* arg1=strtok(args, " ");
  if(arg1==NULL){
    printf("No argument1 , the format 'x [N] EXPR'\n");
    return 0;
  }else{
    len = strtol(arg1,NULL,0);
  }
  char* arg2=strtok(NULL, " ");
  if(arg2==NULL){
    printf("No argument2 , the format 'x [N] EXPR'\n");
    return 0;
  }else{
    addr = strtol(arg2,NULL,0);
  }
  for(int i=0;i<len;){
    printf(ANSI_FMT("0x%08x:  ",ANSI_FG_BLUE),addr);
    for(int j=0;i<len&&j<4;i++,j++){
      uint32_t data = vaddr_read(addr, 4);
      printf("0x%08x  ",data);
      addr += 4;	
    }
    printf("\n");
  }
  return 0;
} 
```

至此，我们就完成了PA1中的基础设施。