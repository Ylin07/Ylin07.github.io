---
title: 写一个Linux调试器(4)
date: 2025-05-14 19:13:59
series: "写一个 Linux 调试器"
weight: 4
---
上一部分中我们实现了对于程序的汇编级别的调试，但是这种调试，过程繁琐，难度大，且调试过程的可读性较差。我们需要拓展我们的调试器的性能，所以我们需要用到DWARF格式以实现源码级别的调试。

# Dwarf和Elf

在此之前我们需要对这些知识有一定程度的掌握。ELF（可执行和链接格式）是Linux中最广泛使用的对象文件格式，其指定了一种存储二进制文件不同部分方式，如代码，数据，调试信息和字符串等。它还告诉加载器如何将二进制文件准备执行，这包括之处二进制文件不同部分应该放置再内存中的位置。不过这里我们并不着重讨论ELF的文件格式

DWARF是ELF常用的调试信息格式。它和ELF是同步开发的所以适配性比较好。这种格式对应了调试器源代码与二进制之间的关系。这些信息分布在不同的ELF段中，每个段有着不同的信息内容：

+ `.debug_abbrev`：存储`.debug_info`节中的缩写表
+ `.debug_aranges`：提供内存地址与编译单元之间的映射
+ `.debug_frame`：存储调用栈信息
+ `.debug_info`：存储DWARF调试信息的核心数据，包含调试信息条目(DIES)
+ `.debug_line`：存储源代码行号信息
+ `.debug_loc`：存储位置描述信息
+ `.debug_macinfo`：存储宏定义信息
+ `.debug_pubnames`：提供全局对象和函数的查找表
+ `.debug_pubtypes`：提供全局类型的查找表
+ `.debug_ranges`：存储地址范围信息
+ `.debug_str`：存储字符串表
+ `.debug_types`：存储类型描述信息

这里我们着重关注`.debug_line`和`.debug_info`的部分，让我们看看一个简单的程序的DWARF信息

```c
int main(){
    long a = 3;
    long b = 2;
    long c = a + b;
    a = 4;
}
```

## DWARF行表

想要查看程序的`DWARF`信息，我们需要在编译时加入一个`-g`选项，可以看到以下内容：

```bash
.debug_line: line number info for a single cu
Source lines (from CU-DIE at .debug_info offset 0x0000000c):

            NS new statement, BB new basic block, ET end of text sequence
            PE prologue end, EB epilogue begin
            IS=val ISA number, DI=val discriminator value
<pc>        [lno,col] NS BB ET PE EB IS= DI= uri: "filepath"
0x00001129  [   1, 11] NS uri: "/home/ylin/Program/LearnDwarf/test.c"
0x00001131  [   2, 10] NS
0x00001139  [   3, 10] NS
0x00001141  [   4, 10] NS
0x00001150  [   5, 7] NS
0x0000115d  [   6, 1] NS
0x0000115f  [   6, 1] NS ET
```

这一行信息`<pc>        [lno,col] NS BB ET PE EB IS= DI= uri: "filepath"`告诉了我们内容的格式与含义。其中`NS`表示该地址标记了新语句的开始，通常用于设置断点或者单步执行。`PE`标记了函数序言的结束，用于设置函数的入口断点。`ET`标记了翻译单元的结束。其他的信息在上方均有显示。

假如我们想在`test.c`的第四行设置一个断点，我们该怎么做？我们寻找与该文件对应的条目，然后寻找相关的行的条目，查找也与之对应的地址，并设置断点。这里我们对应的条目是：

```bash 
0x00001139  [   3, 10] NS
```

所以我们需要在程序加载地址处偏移地址为`0x00001139`的地方，下断点，就可以实现在第四行下断点。

我们查看`objdump`的内容，也的确如此：

![image.png](https://s2.loli.net/2025/05/14/g1BbqjmcDPXUf2W.png)

反向的操作也是如此。如果我们有一个内存位置——比如说，一个程序计数器的值，我们想知道他在源码中的位置，我们可以通过行表信息中最近的映射地址，并从那里获取行。

## DWARF 调试信息

`.debug_info`是DWARF的核心。它提供了关于程序中存在的类型、函数、变量等信息。这个节中的基本单元是`DWARF`信息条目，通常称为DIES。一个DIE由一个标签组成，告诉你它所表示的源码级的实体类型，后面跟着有一系列使用与该实体的属性。下面是我们程序的`.debug_info`节：

```bash
.debug_info

COMPILE_UNIT<header overall offset = 0x00000000>:
< 0><0x0000000c>  DW_TAG_compile_unit
                    DW_AT_producer              GNU C17 13.3.0 -mtune=generic -march=x86-64 -g -fasynchronous-unwind-tables -fstack-protector-strong -fstack-clash-protection -fcf-protection
                    DW_AT_language              DW_LANG_C11
                    DW_AT_name                  test.c
                    DW_AT_comp_dir              /home/ylin/Program/LearnDwarf
                    DW_AT_low_pc                0x00001129
                    DW_AT_high_pc               <offset-from-lowpc> 54 <highpc: 0x0000115f>
                    DW_AT_stmt_list             0x00000000

LOCAL_SYMBOLS:
< 1><0x0000002e>    DW_TAG_subprogram
                      DW_AT_external              yes(1)
                      DW_AT_name                  main
                      DW_AT_decl_file             0x00000001 /home/ylin/Program/LearnDwarf/test.c
                      DW_AT_decl_line             0x00000001
                      DW_AT_decl_column           0x00000005
                      DW_AT_type                  <0x00000072>
                      DW_AT_low_pc                0x00001129
                      DW_AT_high_pc               <offset-from-lowpc> 54 <highpc: 0x0000115f>
                      DW_AT_frame_base            len 0x0001: 0x9c:
                          DW_OP_call_frame_cfa
                      DW_AT_call_all_calls        yes(1)
                      DW_AT_sibling               <0x00000072>
< 2><0x00000050>      DW_TAG_variable
                        DW_AT_name                  a
                        DW_AT_decl_file             0x00000001
                        DW_AT_decl_line             0x00000002
                        DW_AT_decl_column           0x0000000a
                        DW_AT_type                  <0x00000079>
                        DW_AT_location              len 0x0002: 0x9158:
                            DW_OP_fbreg -40
< 2><0x0000005b>      DW_TAG_variable
                        DW_AT_name                  b
                        DW_AT_decl_file             0x00000001
                        DW_AT_decl_line             0x00000003
                        DW_AT_decl_column           0x0000000a
                        DW_AT_type                  <0x00000079>
                        DW_AT_location              len 0x0002: 0x9160:
                            DW_OP_fbreg -32
< 2><0x00000066>      DW_TAG_variable
                        DW_AT_name                  c
                        DW_AT_decl_file             0x00000001
                        DW_AT_decl_line             0x00000004
                        DW_AT_decl_column           0x0000000a
                        DW_AT_type                  <0x00000079>
                        DW_AT_location              len 0x0002: 0x9168:
                            DW_OP_fbreg -24
< 1><0x00000072>    DW_TAG_base_type
                      DW_AT_byte_size             0x00000004
                      DW_AT_encoding              DW_ATE_signed
                      DW_AT_name                  int
< 1><0x00000079>    DW_TAG_base_type
                      DW_AT_byte_size             0x00000008
                      DW_AT_encoding              DW_ATE_signed
                      DW_AT_name                  long int
```

第一个DIE代表一个编译单元（CU），下面是一些属性的含义：

+ `DW_AT_producer`：生成的此可执行文件的编译器
+ `DW_AT_language`：源语言
+ `DW_AT_name`：此编译单元所代表的文件名
+ `DW_AT_comp_dir`：编译目录
+ `DW_AT_low_pc`：此CU的代码开始
+ `DW_AT_high_pc`：此CU的代码结束

其他的DIES属性遵循差不多的方案，你可以推断出不同属性的含义。接下来我们使用DWARF的知识解决一些实际的问题

## 定位我们所在的函数

假设我们已有当前的程序计数器的值，我们想要弄清楚我们处在哪个函数之中，有一个算法是这样的：

```python 
for each compile unit:
	if the pc is between DW_AT_low_pc and DW_AT_high_pc:
        for each function in the compile uint:
            if the pc is between DW_AT_low_pc and DW_AT_high_pc:
                return function information
```

这个算法适用于各种用途，但在存在成员函数和内联的情况下，事情会变得比较困难。在内联的情况下，一但我们找到了包含我们PC的函数，我们需要递归遍历该DIE的子节点，看看是否有内联函数匹配。

## 在一个函数上设置断点

我们要找到的函数，你可以在`DW_AT_low_pc`给出的内存地址上设置断点。但是一般这样做，会导致断点被下在函数序言（一般是用于保存调用者的上下文和设置函数的局部变量空间）的开始处中断，但是我们实际想要的效果是在用户代码处中断。

解决这个问题的办法就是从`DW_AT_low_pc`开始，从行号表中逐条读取，直到找到标记为序言结束（PE）的条目，可以确定代码的起始位置 。不过有时候，有些编译器不会输出这些信息，所以另一种做法是在该函数的第二行条目给出的地址上设置断点。

比如我们想在示例程序中的`main`上设置断点。我们搜索名为`main`的函数，并得到这个DIE:

```bash
< 1><0x0000002e>    DW_TAG_subprogram
                      DW_AT_external              yes(1)
                      DW_AT_name                  main
                      DW_AT_decl_file             0x00000001 /home/ylin/Program/LearnDwarf/test.c
                      DW_AT_decl_line             0x00000001
                      DW_AT_decl_column           0x00000005
                      DW_AT_type                  <0x00000072>
                      DW_AT_low_pc                0x00001129
                      DW_AT_high_pc               <offset-from-lowpc> 54 <highpc: 0x0000115f>
                      DW_AT_frame_base            len 0x0001: 0x9c:
                          DW_OP_call_frame_cfa
                      DW_AT_call_all_calls        yes(1)
```

这告诉我们函数从`0x00001129`的偏移值开始，我们去行目表中查找，可以得到这个信息

```bash
0x00001129  [   1,11] NS uri: "/home/ylin/Program/LearnDwarf/test.c"
```

我们要跳过程序前文，所以读取下一个条目：

```bash
0x00001131  [   2,10] NS
```

这是我们要下断点的位置

## 我们该如何读取变量的内容

读取变量是一件很复杂的事情，它可能存在于不同的栈帧之中，被放置在寄存器中，或者在某个内存之中，也有可能被优化掉。不过我们还是可以通过一些简单的方法去找到它，我们可以查看变量a 的`DW_AT_location`属性：

```bash
< 2><0x00000050>      DW_TAG_variable
                        DW_AT_name                  a
                        DW_AT_decl_file             0x00000001
                        DW_AT_decl_line             0x00000002
                        DW_AT_decl_column           0x0000000a
                        DW_AT_type                  <0x00000079>
                        DW_AT_location              len 0x0002: 0x9158:
                            DW_OP_fbreg -40
< 1><0x00000079>    DW_TAG_base_type
                      DW_AT_byte_size             0x00000008
                      DW_AT_encoding              DW_ATE_signed
                      DW_AT_name                  long int
```

这表示我们的`a`被存储在栈基地址的`-40`偏移地址。为了计算出这个及地址在那里，我们查看该函数的`DW_AT_frame_base`属性：

```bash
DW_AT_frame_base            len 0x0001: 0x9c:
    DW_OP_call_frame_cfa
```

这意味着我们的栈基指针，是通过`CFA`计算得到的。

我们现在找到了这个变量，但是我们需要知道它的信息和类型，我们可以通过`DW_AT_type`找到，这告诉我们类型是一个8字节的有符号整数类型，因此我们可以将这个字节解释为`int64_t`并显示给用户。

我们对DWARF的初步理解就到此为止，接下来尝试使用它吧
