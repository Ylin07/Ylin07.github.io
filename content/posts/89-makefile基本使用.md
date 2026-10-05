---
title: makefile基本使用
series: "工具链学习"
weight: 3
date: 2025-10-21 16:27:29
---
# MAKEFILE教程

之后要尝试做一些项目，在加上前一段时间接触PA，发现自己对自动构建项目一类的操作实在是一知半解，而且之后也需要要尝试自动化编译一些大型的源码，所以学习一下`makefile`的基本使用，完善一下自己对工具链的认知。这里我看的教程是廖雪峰的`makefile`入门

## Makefile基础

在Linux中我们使用`make`命令时，他就会在当前目录下找一个名为`Makefile`的文件，并根据里面的内容进行自动化的执行。我们以下面这个需求为例子：

```text
a.txt + b.txt -> m.txt
m.txt + c.txt -> x.txt
```

上述逻辑我们编写makefile

### 规则

Makefile由各种规则构成，每一条规则需要指出一个目标文件和若干个依赖文件，以及用于生成目标文件的命令，例如我们想要生成`m.txt`则规则如下：

```makefile
# 目标文件: 依赖文件1 依赖文件2 依赖文件...
m.txt: a.txt b.txt
	cat a.txt b.txt > m.txt
```

其中`#`用来注释，一条规则的格式如上，`Tab`后使用命令来实现目标文件

现在我们就可以完整的实现上述的规则：

```makefile
x.txt: m.txt c.txt
	cat m.txt c.txt > x.txt

m.txt: a.txt b.txt
	cat a.txt b.txt > m.txt
```

我们可以尝试执行一下：

```shell
ylin@Ylin:~/Program/test$ make
cat a.txt b.txt > m.txt
cat m.txt c.txt > x.txt
ylin@Ylin:~/Program/test$ ls
a.txt  b.txt  c.txt  Makefile  m.txt  x.txt
ylin@Ylin:~/Program/test$ cat x.txt
I am a.txt
I am b.txt
I am c.txt
ylin@Ylin:~/Program/test$ cat m.txt
I am a.txt
I am b.txt
ylin@Ylin:~/Program/test$
```

`make`默认执行第一条规则，也就是创建`x.txt`，但是由于`x.txt`依赖的文件`m.txt`不存在（另一个依赖`c.txt`已存在），故需要先执行规则`m.txt`创建出`m.txt`文件，再执行规则`x.txt`。执行完成后，当前目录下生成了两个文件`m.txt`和`x.txt`。

所以我们可以知道，实际上Makefile就是一堆规则(即你些的目标文件和依赖)，当满足规则时，就调用规则后的命令，创建出一个新的目标文件

把默认的规则放在第一条，其他规则的顺序makefile会自动判断依赖。`make`会把每次执行的命令输出出来，便于我们观察调试。

如果我们在不对任何目标文件进行修改的情况下，我们在此使用`make`就会得到：

```shell
ylin@Ylin:~/Program/test$ make
make: 'x.txt' is up to date.
```

`make`会根据文件的创建和修改时间来判断是否应该更新一个目标文件，例如我们这里只修改`c.txt`，并不会触发对`m.txt`的更新，因为他的依赖文件没有发生改变：

```shell
ylin@Ylin:~/Program/test$ make
cat m.txt c.txt > x.txt
ylin@Ylin:~/Program/test$ cat x.txt
I am a.txt
I am b.txt
I am c.txt (modified)
ylin@Ylin:~/Program/test$
```

`make`只会重新编译那些依赖被修改，或者是尚未完成的部分，重新编译的过程并不是每一条命令都会执行，`make`只会选择必要的部分执行，我们称这种编译为增量编译。能否正确的实现增量编译，取决于我们编写的规则。

### 伪目标

为了进一步的便于自动化的构建，有时候我们会需要定义一些常用的规则。例如在我们使用`make`之后，我们自动生成了`m.txt`和`x.txt`，现在我们可以定义一个规则用于清理这些生成的文件:

```makefile
clean:
	rm -f m.txt
	rm -f x.txt
```

然后我们可以通过`make clean`来调用这个规则：

```shell
ylin@Ylin:~/Program/test$ ls
a.txt  b.txt  c.txt  Makefile  m.txt  x.txt
ylin@Ylin:~/Program/test$ make clean
rm -f m.txt
rm -f x.txt
ylin@Ylin:~/Program/test$ ls
a.txt  b.txt  c.txt  Makefile
```

但是`make`这里实际上是把clean当作一个目标文件，我们使用`make clean`规则时，`make`检查到没有目标文件`clean`，于是调用命令尝试构建目标文件，但是`clean`文件不会被生成，所以我们总可以使用它。可是如果目录中有一个clean文件怎么办呢？`make`认为clean已经被构建了，就不会再使用命令。为了解决这个问题，我们希望`make`不要将clean视作文件，我们可以添加一个标识：

```makefile
.PHONY: clean
clean:
	rm -f m.txt
	rm -f x.txt
```

此时，clean就不再被视作一个文件，而是伪目标。一般大型项目会有`clean`，`install`一类的常用的伪目标规则，方便用户快速的构建一些任务

### 执行多条命令

一个规则可以有多条命令：

```makefile
cd:
	pwd
	cd ..
	pwd
```
运行结果如下：
```shell
ylin@Ylin:~/Program/test$ make cd
pwd
/home/ylin/Program/test
cd ..
pwd
/home/ylin/Program/test
```

我们发现命令`cd ..`并没有修改当前目录，导致每次输出的`pwd`都是一样的，这是因为`make`针对每条指令都会创建一个独立的shell环境，所以命令之间无法互相影响。但是我们可以用以下方法实现

```makefile
cd_ok:
	pwd; cd ..; pwd;		# 使用;可以将多个命令写在一行(顺序执行,不管成功还是失败)
```

我们查看新的执行结果：

```shell
ylin@Ylin:~/Program/test$ make cd_ok
pwd; cd ..; pwd;
/home/ylin/Program/test
/home/ylin/Program
```

当然也可以再`;`后加`\`便于分行阅读：

```makefile
cd_ok:
	pwd; \
	cd ..; \
	pwd
```

我们需要注意，在`shell`中`;`代表无论当前命令是否生效，都会执行下一个命令。与其相反的一个执行多条命令的语法是`&&`，当前面的命令执行失败时，后续的命令就不会再继续执行了

### 控制打印

默认情况下，`make`会打印出执行的每一条命令，如果我们不想打印某一条命令，我们只需要在命令前面加上`@`，告诉`make`不打印该命令：

```makefile
no_output:
	@echo 'no display'
	echo 'will display'
```

执行结果如下：

```shell
ylin@Ylin:~/Program/test$ make no_output
not display
echo 'will display'
will display
```

### 控制错误

`make`在执行命令时，会检查每一条命令的返回值，如果返回值错误，就会中断执行。

例如我们手动构建一个错误（用`rm`删除一个不存在的文件）：

```makefile
has_error:
	rm zzz.txt
	echo 'OK'
```

会发生：

```shell
ylin@Ylin:~/Program/test$ make has_error
rm zzz.txt
rm: cannot remove 'zzz.txt': No such file or directory
make: *** [Makefile:25: has_error] Error 1
```

但是有时候我们希望忽略错误，我们可以在特定的指令前面加上`-`用来忽略错误的命令：

```makefile
ignore_error:
	-rm zzz.txt
	echo 'ok'
```

输出结果如下：

```shell
ylin@Ylin:~/Program/test$ make ignore_error
rm zzz.txt
rm: cannot remove 'zzz.txt': No such file or directory
make: [Makefile:29: ignore_error] Error 1 (ignored)
echo 'ok'
ok
```

对于执行可能出错，但是不影响逻辑的命令，可以使用`-`忽略

## 编译C程序

现在我们尝试一下编译一个简单的C语言程序，其依赖文件如下：

```text
main.c + hello.h -> main.o
hello.c -> hello.o
hello.o + main.o -> a.out
```

文件内容如下：

```c
// main.c
#include "hello.h"
#include <stdio.h>

int main() {
    printf("starting main\n");
    hello();
    printf("ending main\n");
    return 0;
}

// hello.h
int hello();

// hello.c
#include <stdio.h>
int hello() {
    printf("Hello, World!\n");
    return 0;
}
```

我们可以编写以下规则，用于自动构建可执行程序：

```makefile
a.out: main.o hello.o
	cc -o a.out main.o hello.o
main.o: main.c hello.h
	cc -c main.c
hello.o: hello.c hello.h
	cc -c hello.c
clean:
	rm -f a.out main.o hello.o	
```

同时也可以通过`make clean`来删除中间文件：

```shell
ylin@Ylin:~/Program/test$ ls
a.out  hello.c  hello.h  hello.o  main.c  main.o  Makefile
ylin@Ylin:~/Program/test$ make clean
rm -f a.out main.o hello.o
ylin@Ylin:~/Program/test$ ls
hello.c  hello.h  main.c  Makefile
```

我们可以看到完整的命令流程如下：

```sh
ylin@Ylin:~/Program/test$ make clean && make
rm -f a.out main.o hello.o
cc -c main.c
cc -c hello.c
cc -o a.out main.o hello.o
```

### 隐式规则

为了编译这个项目，我们一共编写了三条规则，现在我们尝试删除两个`.o`文件的规则，然后再编译试试：

```makefile
a.out: main.o hello.o
	cc -o a.out main.o hello.o

clean:
	rm -f a.out main.o hello.o	
```

然后我们执行`make`，输出如下：

```sh
ylin@Ylin:~/Program/test$ make
cc    -c -o main.o main.c
cc    -c -o hello.o hello.c
cc -o a.out main.o hello.o
```

然后可以发现 我们并没有制定相关的规则，可是程序还是正常的进行了编译，这是`make`中的隐式规则，因为`make`本来就是为了编译C程序设计的，所以为了避免重复的编译`.o`文件，在一开始没有找到对应的规则时，会自动的调用隐式规则。对于`C C++ ASM ...`等程序，都有内置的隐式规则，这里不展开叙述。

## 使用变量

我们在编译时难免会遇到许多重复的文件名，为了方便使用，我们引入变量用来解决重复的问题。我们以上一节的`Makefile`为例：

```makefile
a.out: main.o hello.o
	cc -o a.out main.o hello.o

clean:
	rm -f a.out main.o hello.o	
```

我们可以定义一个变量来替换它：

```makefile
TARGET = a.out

$(TARGET): main.o hello.o
	cc -o $(TARGET) main.o hello.o

clean:
	rm -f $(TARGET) main.o hello.o
```

对于变量定义，我们使用`变量名 = 值`，变量名通常使用大写。在引用变量时通常使用`$(变量名)`

当然，对于我们的依赖文件列表，也可以使用变量进行替换：

```makefile
TARGET := a.out
OBJS := main.o hello.o

$(TARGET): $(OBJS)
	cc -o $(TARGET) $(OBJS)

clean:
	rm -f $(TARGET) $(OBJS)
```

但是对于依赖文件很多的情况下，我们可能需要一个自动化的方式，来将我们的源文件批量编译成目标文件。我们注意到每个`.o`文件都是由对应的`.c`文件编译产生的，我们可以让`make`先获取`.c`文件列表再替换生成得到`.o`文件列表：

```makefile
TARGET := a.out
# wildcard意为通配符,即使用通配符去匹配*.c
# patsubst是pattern substitute的缩写,即模式替换,参数为(源模式,目标模式,文件列表)
OBJS := $(patsubst %.c,%.o,$(wildcard *.c))

$(TARGET): $(OBJS)
	cc -o $(TARGET) $(OBJS)

clean:
	rm -f $(TARGET) $(OBJS)
```

### 内置变量

为了方便我们使用，`make`也内置了很多的内置变量，例如我们可以用`$(CC)`替换命令`cc`:

```makefile
$(TARGET): $(OBJS)
	$(CC) -o $(TARGET) $(OBJS)
```

这样方便我们在交叉编译时，指定编译器。诸如此类的内置变量还有很多，遇到了再学吧。

### 自动变量

在`makefile`中，经常会看到`$@`、`$<`之类的变量，这种变量称为自动变量，它们在一个规则中自动指向某个值。例如`$@`标识目标文件，`$^`表示所以依赖文件，所以我们也可以这样写：

```makefile
a.out: hello.o main.o
	@echo '$$@ = $@' # 变量 $@ 表示target
	@echo '$$< = $<' # 变量 $< 表示第一个依赖项
	@echo '$$^ = $^' # 变量 $^ 表示所有依赖项
	cc -o $@ $^
```

## 模式规则

我们前面提到隐式转换可以在必要时自动创建`.o`文件，但实际上隐式规则的命令是固定的：

```makefile
$(CC) $(CFLAGS) -c -o $@ $<
```

我们只能修改编译器变量和编译选项变量，但没办法运行多条命令。

此时我们就要引入自定义模式规则，它使用`make`的匹配模式规则，如果匹配上了，就自动创建一条模式规则，我们可以把我们的`makefile`写成以下内容：

```makefile
TARGET := a.out
OBJS := $(patsubst %.c,%.o,$(wildcard *.c))

$(TARGET): $(OBJS)
	$(CC) -o $(TARGET) $(OBJS)

%.o: %.c
	@echo "Compiling $< to $@"
	$(CC) -c $< -o $@

clean:
	rm -f $(TARGET) $(OBJS)
```

当程序执行`a.out: hello.o main.o`时，发现没有`hello.o`，于是查找以`hello.o`为目标文件的规则，结果匹配到模式规则`*.o : *.c`，于是模式规则会动态的创建以下规则：

```makefile
hello.o: hello.c
	@echo "Compiling $< to $@"
	$(CC) -c $< -o $@
```

我们可以尝试执行一下`make`:

```sh
ylin@Ylin:~/Program/test$ make
Compiling hello.c to hello.o
cc -c hello.c -o hello.o
Compiling main.c to main.o
cc -c main.c -o main.o
cc -o a.out hello.o main.o
```

这样他可以比隐式的规则更灵活。但是我们现在也遇到一个问题，就是当我们修改`hello.h`头文件时，不会触发`main.c`重新编译的问题，我们之后在解决。

## 自动完成依赖

我们刚刚提到，在我们可以解决自动把`.c`编译成`.o`文件，但是难以解决`.c`文件对`.h`文件的依赖规则。因为要想知道`.h`的依赖关系，我们需要分析文件内容才能做到，并没有一个简单的文件名映射规则。

好在我们可以使用`gcc`提供的`-MM`参数，自动分析我们所需要的`.h`文件参数：

```sh
ylin@Ylin:~/Program/test$ cc -MM main.c
main.o: main.c hello.h
```

因此，我们可以利用这个功能，为每个`.c`文件都生成一个依赖项，并把它保存到`.d`(中间文件中)，再使用`include`将其导入`makefile`中，这样我们就精准的实现了`.c`文件的依赖分析。

我们可以更新我们的`makefile`:

```makefile
TARGET := a.out
SRCS := $(wildcard *.c)
OBJS := $(SRCS:.c=.o)
DEPS := $(SRCS:.c=.d)

$(TARGET): $(OBJS)
	$(CC) -o $@ $^

%.d: %.c
	rm -f $@; \
	$(CC) -MM $< >$@.tmp; \
	sed 's,\($*\)\.o[ :]*,\1.o $@ : ,g' < $@.tmp > $@; \
	rm -f $@.tmp

%.o: %.c
	$(CC) -c $< -o $@

clean:
	rm -f $(TARGET) $(OBJS) $(DEPS)

include $(DEPS)
```

当我们运行时，通过include会引入`.d`文件，但是一开始`.d`文件并不存在，这时会通过模式规则匹配到`%.d: %.c`。这里用了一个复杂的`sed`将`.d`文件创建了出来。我们运行`make`结果如下：

```sh
ylin@Ylin:~/Program/test$ make
rm -f main.d; \
cc -MM main.c >main.d.tmp; \
sed 's,\(main\)\.o[ :]*,\1.o main.d : ,g' < main.d.tmp > main.d; \
rm -f main.d.tmp
rm -f hello.d; \
cc -MM hello.c >hello.d.tmp; \
sed 's,\(hello\)\.o[ :]*,\1.o hello.d : ,g'< hello.d.tmp > hello.d; \
rm -f hello.d.tmp
cc -c hello.c -o hello.o
cc -c main.c -o main.o
cc -o a.out hello.o main.o
```

我们可以看到`.d`文件中类似：

```makefile
main.o main.d : main.c hello.h
```

现在，我们文件的依赖就加入了头文件，当我们对头文件进行修改时，就会触发重新编译

```sh
ylin@Ylin:~/Program/test$ make
rm -f main.d; \
cc -MM main.c >main.d.tmp; \
sed 's,\(main\)\.o[ :]*,\1.o main.d : ,g' < main.d.tmp > main.d; \
rm -f main.d.tmp
cc -c main.c -o main.o
cc -o a.out hello.o main.o
```

## 完善Makefile

我们现在对项目目录进行整理，我们将源码放入`src`目录，将编译生成的文件放入`build`目录：

```sh
ylin@Ylin:~/Program/test$ tree .
.
├── build
├── Makefile
└── src
    ├── hello.c
    ├── hello.h
    └── main.c
```

现在我们可以使用我们上述的操作，更新我们的makefile:

```makefile
SRC_DIR := ./src
BUILD_DIR := ./build
TARGET = $(BUILD_DIR)/a.out

CC = gcc
CFLAGS = -Wall

SRCS = $(wildcard $(SRC_DIR)/*.c)
OBJS = $(patsubst $(SRC_DIR)/%.c,$(BUILD_DIR)/%.o,$(SRCS))
DEPS = $(patsubst $(SRC_DIR)/%.c,$(BUILD_DIR)/%.d,$(SRCS))

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) -o $@ $^

$(BUILD_DIR)/%.d: $(SRC_DIR)/%.c
	@mkdir -p $(BUILD_DIR)
	rm -f $@; \
	$(CC) -MM $< >$@.tmp; \
	sed 's,\($*\)\.o[ :]*,$(BUILD_DIR)\1.o $@ : ,g' < $@.tmp > $@; \
	rm -f $@.tmp

$(BUILD_DIR)/%.o: $(SRC_DIR)/%.c
	@mkdir -p $(BUILD_DIR)
	$(CC) $(CFLAGS) -c -o $@ $<

clean:
	@echo "Cleaning up..."
	rm -rf $(BUILD_DIR)

include $(DEPS)
```

我们通过设置目录路径变量实现了对一个简单项目的自动化编译。至此我们的对`makefile`的基本使用就了解了

对于makefile，它还有很多的复杂的用法，但是之后我会更好的利用它去做更多的项目。
