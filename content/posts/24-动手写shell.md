---
title: 动手写shell
date: 2025-03-14 14:19:22
---
最近一直在学习，但是却忽略了最基本的需求——想要有所反馈，所以的话找了几个项目来做一做，这里的话我挑选的是一个用C语言实现shell的项目，用的是Linux编程，刚好我还没有试过在WSL上的编程开发，所以试一试呀，顺便把这个英语博客翻译一遍，锻炼下水平。

项目地址：[[brenns10/lsh: Simple shell implementation. Tutorial here ->](https://github.com/brenns10/lsh)]

# LinuxShell

## Shell 的生命周期

Shell 在其生命周期中主要有以下三个动作：

+ 初始化：

  在这一步中，一个典型的Shell会读取并执行它的配置文件，从而引导shell的行为。

+ 解释：

  接着shell会从标准输入(stdin)中读取并执行你的输入（这里的输入还可以是文件等内容）

+ 终端：

  当程序被执行之后，Shell需要负责关闭程序，释放内存，并将其终止

这几个步骤在许多程序开发中都是适用的，但是我们将使用他们作为我们的Shell程序的基础。我们的程序十分简单，不需要任何配置文件，也不需要任何关闭命令。实际上，我们只需要循环调用并终止它们。当然在我们的程序架构中，循环并不是最为重要的。

```c
int main(int argc,char ** argv){
  //加载配置文件（如果有的话）

  //执行循环指令
  lsh_loop();

  //关闭清理操作
  
  return EXIT_SUCCESS;

}
```

这里你可以看到实际上就一个函数，它将不停的循环解释命令。我们接下来来完成`lsh_loop()`的实现

## Shell中的基础循环

我们已经考虑完了程序的启动。现在，我们需要搞清楚程序的逻辑，在一次又一次的循环中，我们需要做什么？实际上，我们只需要实现三个步骤以处理这些命令：

+ **读取**：从标准输入中读取命令
+ **解析**：分割命令，将其分为程序与参数
+ **运行**：运行解析后的命令

接下来，让我们一点点实现它：
```c
void lsh_loop(){
  char *line;
  char **args;
  int status;

  do {
    printf("> ");
    line = lsh_read_line();
    args = lsh_spilt_line(line);
    status = lsh_execute(args);

    free(line);
    free(args);
  } while (status);
}
```

我们看这个程序，前几行是几个变量的声明。这个DO-WHILE循环则是用来方便用来对status变量的检查，因为在每次循环后都会检查一遍它的值。在循环中，我们打印一个提示符，然后读取一行，使用函数来将其划分为关键词，然后再去执行他们。最终我们释放读取的行字符和我们创建的参数变量。在这里我们利用`lsh_execute()`返回的的status来决定何时退出循环。

## 行读取

从标准输入中读取一行看起来很容易，但是在C里面实现起来很困难[^1]，因为你并不知道用户会往里面输入多长的内容。你不能只是简单的分配一个内存块，然后祈祷用户的输入不会超出内存块的大小。相反，你需要从一个内存块开始，如果超出了它们，就再次分配一个空间给他们。这是在C中常用的一种策略，我们在下面实现它：

```c
char *lsh_read_line(){
  int bufsize = LSH_RL_BUFSIZE;
  int position = 0;
  char *buffer = malloc(sizeof(char) * bufsize);
  int c;
  
  if(!buffer){
    fprintf(stderr,"lsh: allocation error\n");
    exit(EXIT_FAILURE);
  }

  while (1){
    //读取字符
    c = getchar();

    //确定结束条件
    if(c == EOF || c == '\n'){
      buffer[position] = '\0';
      return buffer;
    }else{
      buffer[position] = c;
    }
    position++；

    //如果超出缓冲区，则拓展新的缓冲区
    if (position >= bufsize){
      bufsize += LSH_RL_BUFSIZE;
      buffer = realloc(buffer,bufsize);
      if(!buffer){
        fprintf(stderr,"lsh: allocation error\n");
        exit(EXIT_FAILURE);
      }
    }
  }
}
```

前面是一些声明。不过你不用太过在意他们，我更喜欢使用旧的C语言风格——在代码块的前面声明变量。而这个函数的核心则是在循环部分。在循环中我们读取字符（我们将其存储为整数型，而不是一个字符，在比较EOF时，是整型的比较[^2]这是C语言新手经常会犯的错误），如果是回车或者EOF，我们终止并返回它，反之则继续添加字符。

接着，我们需要知道接下来的字符会不会超出缓冲区的大小。如果会的话我们就重新申请一块空间，然后再继续（要注意是否声明出错哦），这样就解决了。

熟悉最新的C语言标准的读者可能注意到，我们写的这个程序实际上已经有实现的函数了`getline()`。这个函数是GNU对C语言库的拓展。用它实现会更加的容易，不过上面的程序能帮你更好的理解这个函数的实现

```c
char *lsh_read_line(){
  char *line = NULL;
  ssize_t bufsize = 0;
  if (getline(&line,&buffer,stdin) == -1){
    if (feof(stdin)){
      exit(EXIT_SUCCESS); //读取到了EOF
    }else{
      perror("readline");
      exit(EXIT_FAILURE);
    }
  }
  return line;
}
```

## 解析行

OK我们将目光放回循环中，我们已经实现了对它的读取，现在我们需要将其解释为一个参数列表。我们尽可能的简化它，所以在这里我们不支持引号和反斜杠转义在我们的命令行参数中。相反，我们将简单的使用空格来将参数一一分隔开来。所以命令`echo "this message"`并不会打印出`this message`，而是打印出`this`和`message`

通过这些简化，我们用空格将他们划分为`token`，我们可以用标准库中的`strtok`函数实现

```c
#define LSH_TOK_BUFSIZE 64
#define LSH_TOK_DELIM " \t\r\n\a"

char **lsh_split_line(char *line){
  int bufsize = LSH_TOK_BUFSIZE,position = 0;
  char **tokens = malloc(bufsize * sizeof(char*));
  char *token;

  if(!token){
    fprintf(stderr,"lsh: allocation error\n");
    exit(EXIT_FAILURE);
  }

  token = strtok(line,LSH_TOK_DELIM);
  while(token != NULL){
    tokens[position] = token;
    position++;

    if (position >= bufsize){
      bufsize += LSH_TOK_BUFSIZE;
      tokens = realloc(tokens,bufsize * sizeof(char*));
      if(!tokens){
        fprintf(stderr,"lsh: allocation error\n");
        exit(EXIT_FAILURE);
      }
    }

    token = strtok(NULL,LSH_TOK_DELIM);

  }
  tokens[position] = NULL;
  return tokens;
}
```

也许你会发现这些代码长得很像，当然如此！我们使用相同的策略实现缓冲区的动态分配，不过这一次我们使用的是以NULL结尾的指针数组，而不是以'\0'结尾的字符数组

在函数的开始，通过对`strtok()`的调用，我们返回第一个标记的地址，实际上返回的是你给的字符串的地址。且用'\0'替换分隔符号，接着将每一个指针存放在指向字符的指针数组中

如果有必要的话，我们会重新分配指针数组的大小，直到没有token返回，此时终止读取

当我们得到了这些token和存储它的数组，我们要准备解析它了。接下来面临一个问题，我们该怎么做呢？

## Shell如何启动进程

现在，我们已经来到了Shell的核心问题——启动进程。写一个Shell程序意味着你需要知道一个进程做了什么，以及怎么去启动它。接下来我们将简单的讨论一下类Unix系统中的进程

在Unix中只有两种方式去启动一个进程。第一种（几乎不算）是Init，当Unix系统启动时，它的内核被加载。当它的内核被加载并初始化时，内核将启动一个进程，即Init。这个进程一直运行在计算机的运行过程中，它负责加载那些其他的计算机所要用到的进程。

由于大多数进程并不是Init,所以实际上只剩下另一种启动进程的方法：系统调用。当调用一个函数时，操作系统复制进程并将他们运行。其中原来的进程被称之为“父进程”，新的进程被称之为“子进程”。将0返回给子进程并将子进程的PID返回给父进程。实际上，这意味着启动新进程的方式就是复制现有的进程。`(fork)`

这面临着一些问题。典型的，当你想要运行一个新的进程，你并不仅仅想要运行一个一样的进程，而是运行一个不一样的程序。这就是系统调用的意义所在。它用一个全新的程序替换当前正在运行的程序，这意味着当你调用时，操作系统将停止你的进程，加载新程序，并在其位置启该程序。进程不会从调用中返回（除非它发生了错误）`(exec)`

通过着两种系统调用，我们有了大多数程序在Unixs上运行的基本要素。首先一个现有的进程分成两个单独的部分。然后子进程将被替换成一个新的进程，父进程可以继续做其他的事情，甚至可以通过系统调用继续对子进程进行访问。

讲了这么多，现在，可以终于可以尝试编写一段启动代码了：

```c
int lsh_launch(char **args){
  pid_t pid;
  int status;

  pid = fork();
  if(pid == 0){
    //子进程
    if(execvp(args[0],args) == -1){
      perror("lsh");
    }
    exit(EXIT_FAILURE);
  }else if(pid < 0){
    //错误的进程
    perror("lsh");
  }else{
    //父进程
    do{
      wpid = waitpid(pid,&status,WUNTRACED);
    }while (!WIFEXITED(status) && !WIFSIGNALED(status));
  }
  return 1;
}
```

现在这个函数将使用我们先前解析的参数列表。然后分叉这个进程，并保存返回值（PID）。当`fork（）`成功返回，此时我们有两个并发的进程。子进程将进入判断逻辑的第一种情况。

在子程序中我们希望能够运行用户的命令。所以我们使用`exec`系统调用的变种之一`execvp`。和exec的其他几个变种实现的效果有略微的不同。有的变种需要可变长度的字符串参数，有的则需要字符串列表，还有的需要指定进程使用的环境。而`execvp()`需要一个程序名称和一个字符串参数的列表（第一个参数必须是程序的名称，而不应该是程序的文件路径），当我们将程序名称传递给它，操作系统将在系统文件路径中去查询它

如果解析命令返回了-1(实际上可能返回其他的)，那么说明产生了错误。此时我们使用`perror`打印系统的错误信息，前面加上程序的名称，以便于用户知道错误产生于哪里。然后我们退出当前进程以确保程序能继续运行

第二种判断情况说明`fork()`产生了错误。如果确实如此我们向用户返回错误信息，并确认是否需要终止。

第三种判断情况意味着`fork()`的子进程创建很成功。此时父进程将待命，我们知道子进程正在运行当前进程，因此父进程需要等待命令的完成。我们使用`waitpid()`等待进程的状态改变。不过进程的改变可能是由于各种原因，不仅仅只是因为进程终止了，进程可能是因为正常退出了，也可能是因为错误的代码，或是因为信号的终止。所以我们使用`waitpid()`提供的宏定义等待程序的退出或终止。当函数最终返回1，这意味着我们继续读取命令并执行了

## 内置函数

你也许会注意到`lsh_loop()`调用了`lsh_execute()`，但是在上面，我却又命名了一个函数`lsh_launch`，这是故意的。你看，大多数的命令在Shell中被解析为程序，但并不是所有，有一些是直接写入Shell中的

原因很简单。如果你想要更改当前所在的目录。你需要使用函数`chdir()`，问题是文件目录是当前进程的一个属性，所以如果你要使用`cd`改变当前目录的话，它将改变你当前进程的文件目录，父进程的目录将会保持不变。相反的是，Shell进程本身需要调用`chdir()`来更新它的目录。然后再启动子进程，它将继承当前的文件目录

相似的，`exit`程序，它将无法退出调用它的Shell程序，所以这个程序也需要内置在Shell中。当然，许多Shell程序都是通过配置运行配置文件进行的，比如`~/.bashrc`这些脚本使用更改Shell操作的命令。不过这些命令只有在 shell 进程本身内部实现时才能更改 shell 的操作。

所以这意味着我们需要添加一些Shell本身的命令。这里我们添加`cd`,`exit`和`help`程序，以下是它的实现：

```c
//内置函数
int lsh_cd(char **args);
int lsh_help(char **args);
int lsh_exit(char **args);
//内置指令
char *builtin_str[] = {
  "cd",
  "help",
  "exit"
};
//函数指针
int (*builtin_func[])(char **)={
  &lsh_cd,
  &lsh_help,
  &lsh_exit
};

int lsh_num_builtins(){
  return sizeof(builtin_str) / sizeof(char *);
}

int lsh_cd(char **args){
  if(args[1] == NULL){
    fprintf(stderr,"lsh: expected argument to \"cd\"\n");
  }else{
    if(chdir(args[1]) != 0){
      perror("lsh");
    }
  }
  return 1;
}

int lsh_help(char **args){
  int i;
  printf("Stephen Brennan's LSH\n");
  printf("Type program names and arguments,and hit enter.\n");
  printf("The following are built in:\n");

  for(i=0;i<lsh_num_builtins();i++){
    printf(" %s\n",builtin_str[i]);
  }

  printf("Use the man command for information on other programs.\n");
  return 1;
}

int lsh_exit(char **args){
  return 0;
}
```

这一部分的代码有三个部分，第一部分包含了对函数的声明。提供函数原型是为了你可以使用它（即不定义函数内容，但声明后可以使用）。这是因为我们我们使用`lsh_help()`时，用到了内置函数数组，这个函数中包含了`lsp_help()`，如果想要打破这个循环则需要一开始就提供函数原型。

第二部分则是一个字符串数组，存储了函数的名称。后面跟了对应的函数指针的数组。这样将来就可以通过编辑函数数组来实现向其中添加功能，而且可以避免编写大型的switch程序。如果你对`builtin_func`的作用有所疑惑的话，那没问题！我也是。这是一个函数指针数组（它们都需要提供一个字符串数组，然后返回一个整数型的数值）任何涉及C语言中函数指针的声明都会变得十分复杂。我每次都要搜一下怎么声明[^3]

最终，我们实现了这几个函数功能。`lsh_cd`函数首先检查第二个参数是否存在，如果不存在的话就打印错误信息。然后调用`chdir()`检查是否有误并返回。而`lsp_help`函数则是打印了作品的信息，还有内置的函数功能。最后`lsp_exit`函数返回0，作为终止循环的信号

## 分析

最后的一部分就是实现`lsh_execute()`,这个函数将用来调用内置函数，或是用来启动Shell进程，如果你读到了这里，你就知道我们为自己设置了多么简单的功能：

```c
int lsh_execute(char **args){
  int i;
  if(args[0] == NULL){
    //空指令，直接返回
    return 1;
  }
  for(i=0;i<lsh_num_builtins();i++){
    if(strcmp(args[0],builtin_str[i]) == 0)
      return (*builtin_func[i])(args);
  }

  return lsh_launch(args);
}

```

这些操作实际上是为了检查你输入的命令是否等于内置函数，如果是的话，就调用它，如果不是的话，将会调用`lsh_launch()`去启动这个进程。如果用户输入了一个空字符串，则会被警告参数为NULL。所以我们需要检查输入

## 整合

以上就是Shell所有的程序了。如果你耐心的读完了，那么你已经完全理解了Shell是怎么实现的了，快去试试吧。你只需要将这些代码复制到一个文件中，然后编译它。将你需要的文件头包含在里面。接下来我将提供我们从文件头中所用到的函数：

+ #include <sys/wait.h>
  + waitpid() and its macros
+ #include <unistd.h>
  + chdir()
  + fork()
  + exec()
  + pid_t
+ #include <stdlib.h>
  + malloc()
  + realloc()
  + free()
  + exit()
  + execvp()
  + EXIT_SUCCESS,EXIT_FAILURE
+ #include <stdio.h>
  + fprintf()
  + pintf()
  + stderr
  + getchar()
  + perror()
+ #include <string.h>
  + strcmp()
  + strtok()

你可以在开头的链接找到这篇文章的出处和源代码。

----------------------------------------------

翻译加复现和学习差不多花了两天，感觉很有收获，很多地方翻译的不是很好，但是大致能理解。就我个人的感受而言，我感觉看英文的话勉强可以看懂是啥意思，但是翻译成中文的话总是不能很好的表达出来，可能这也和专业水平有关吧（加上我的英语不是很好）。我觉得这是一篇很好的文章，尤其是其中关于进程的部分让我学到了很多东西。我自己也跟着复现了一遍，为此我还配置了我的neovim（真的好帅）,不过由于语法检测没有配置好，所以最后编译的时候还是一堆问题，磕磕绊绊的，但是还是让它成功的跑起来了，很有成就感！

最后附上我完整的程序（作者的信息我并没有修改，毕竟是一次复现）

```c
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/wait.h>

#define LSH_RL_BUFSIZE 1024
#define LSH_TOK_BUFSIZE 64
#define LSH_TOK_DELIM " \t\r\n\a"

//内置函数
int lsh_cd(char **args);
int lsh_help(char **args);
int lsh_exit(char **args);
//内置指令
char *builtin_str[] = {
  "cd",
  "help",
  "exit"
};
//函数指针
int (*builtin_func[])(char **)={
  &lsh_cd,
  &lsh_help,
  &lsh_exit
};

void lsh_loop();
char *lsh_read_line();
char **lsh_split_line(char *line);
int lsh_launch(char **args);
int lsh_execute(char **args);
int lsh_num_builtins();

int main(int argc,char ** argv){
  //加载配置文件（如果有的话）

  //执行循环指令
  lsh_loop();

  //关闭清理操作
  
  return EXIT_SUCCESS;
}

void lsh_loop(){
  char *line;
  char **args;
  int status;

  do {
    printf("> ");
    line = lsh_read_line();
    args = lsh_split_line(line);
    status = lsh_execute(args);

    free(line);
    free(args);
  } while (status);
}

char *lsh_read_line(){
  int bufsize = LSH_RL_BUFSIZE;
  int position = 0;
  char *buffer = malloc(sizeof(char) * bufsize);
  int c;
  
  if(!buffer){
    fprintf(stderr,"lsh: allocation error\n");
    exit(EXIT_FAILURE);
  }

  while (1){
    //读取字符
    c = getchar();

    //确定结束条件
    if(c == EOF || c == '\n'){
      buffer[position] = '\0';
      return buffer;
    }else{
      buffer[position] = c;
    }
    position++;

    //如果超出缓冲区，则拓展新的缓冲区
    if (position >= bufsize){
      bufsize += LSH_RL_BUFSIZE;
      buffer = realloc(buffer,bufsize);
      if(!buffer){
        fprintf(stderr,"lsh: allocation error\n");
        exit(EXIT_FAILURE);
      }
    }
  }
}

/*
//getline实现行读取
char *lsh_read_line(){
  char *line = NULL;
  ssize_t bufsize = 0;
  if (getline(&line,&buffer,stdin) == -1){
    if (feof(stdin)){
      exit(EXIT_SUCCESS); //读取到了EOF
    }else{
      perror("readline");
      exit(EXIT_FAILURE);
    }
  }
  return line;
}
*/

char **lsh_split_line(char *line){
  int bufsize = LSH_TOK_BUFSIZE,position = 0;
  char **tokens = malloc(bufsize * sizeof(char*));
  char *token;

  if(!token){
    fprintf(stderr,"lsh: allocation error\n");
    exit(EXIT_FAILURE);
  }

  token = strtok(line,LSH_TOK_DELIM);
  while(token != NULL){
    tokens[position] = token;
    position++;

    if (position >= bufsize){
      bufsize += LSH_TOK_BUFSIZE;
      tokens = realloc(tokens,bufsize * sizeof(char*));
      if(!tokens){
        fprintf(stderr,"lsh: allocation error\n");
        exit(EXIT_FAILURE);
      }
    }

    token = strtok(NULL,LSH_TOK_DELIM);

  }
  tokens[position] = NULL;
  return tokens;
}

int lsh_launch(char **args){
  pid_t pid;
  int status;

  pid = fork();
  if(pid == 0){
    //子进程
    if(execvp(args[0],args) == -1){
      perror("lsh");
    }
    exit(EXIT_FAILURE);
  }else if(pid < 0){
    //错误的进程
    perror("lsh");
  }else{
    //父进程
    do{
      waitpid(pid,&status,WUNTRACED);
    }while (!WIFEXITED(status) && !WIFSIGNALED(status));
  }
  return 1;
}

int lsh_num_builtins(){
  return sizeof(builtin_str) / sizeof(char *);
}

int lsh_cd(char **args){
  if(args[1] == NULL){
    fprintf(stderr,"lsh: expected argument to \"cd\"\n");
  }else{
    if(chdir(args[1]) != 0){
      perror("lsh");
    }
  }
  return 1;
}

int lsh_help(char **args){
  int i;
  printf("Stephen Brennan's LSH\n");
  printf("Type program names and arguments,and hit enter.\n");
  printf("The following are built in:\n");

  for(i=0;i<lsh_num_builtins();i++){
    printf(" %s\n",builtin_str[i]);
  }

  printf("Use the man command for information on other programs.\n");
  return 1;
}

int lsh_exit(char **args){
  return 0;
}

int lsh_execute(char **args){
  int i;
  if(args[0] == NULL){
    //空指令，直接返回
    return 1;
  }
  for(i=0;i<lsh_num_builtins();i++){
    if(strcmp(args[0],builtin_str[i]) == 0)
      return (*builtin_func[i])(args);
  }

  return lsh_launch(args);
}

```

[^1]: 在作者那个时候可能没有getline()不过后文有补充
[^2]: 我一开始不信，尝试并了解了一下确实如此，getchar()返回的是一个整数
[^3]:作者在这里补充了一句，距离写这个文章之后过去了6年。期间他仍然是以写C语言为主，但是每次遇到函数指针的问题，他还是得谷歌一下（函数指针真的怪怪的）