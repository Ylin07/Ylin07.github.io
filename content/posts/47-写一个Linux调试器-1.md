---
title: 写一个Linux调试器(1)
date: 2025-05-08 10:57:16
series: "写一个 Linux 调试器"
weight: 1
---
之前一段时间在研究Linux下的虚拟内存分布，还有一些比较细节的内容吧。现在打算更加深入了解这个内容，刚好看到了这篇教程，所以打算花一周左右的时间跟着学习一下，顺便做个简陋的翻译吧。这里我们使用的C++

这是项目的源地址： [编写 Linux 调试器第一部分：设置 --- Writing a Linux Debugger Part 1: Setup](https://blog.tartanllama.xyz/writing-a-linux-debugger-setup/)

# 准备

## 环境准备

要用到`Linenoise `库和`libelfin`库，也不知道配好没有，先这么开始吧

## 启动可执行文件

在我们实际开始调试任何程序之前，我们首先需要启动被调试的进程。我们使用最经典的`fork/exec`来完成这个功能

```cpp
#include<iostream>
#include<unistd.h>

int main(int argc,char* argv[]){
	if(argc<2){
		std::cerr << "请指定要调试的程序名称“;
		return -1;
	}

	auto prog = argv[1];
	
	auto pid = fork();
	if(pid == 0){
	
	}else if(pid >= 1){
	
	}
}
```

我们使用`fork`将进程分裂，如果我们在子进程中，`fork`会向我们返回0。如果我们在父进程中，`fork`会向我们返回当前的进程号

如果我们在子进程中，我们将我们想要调试的程序替换当前正在执行的程序，以下是我们要用到的函数：

```c
long ptrace(enum __ptrace_request request, pid_t pid, void *addr, void *data);
int execl(const char *path, const char *arg, ...);
```

其中`pstrace`允许我们通过读取寄存器，读取内存，的那部执行等方式来对一个程序实现调试执行。我们介绍一下它的使用：

+ `request:`指定对被跟踪进程执行的操作
+ `pid:`被跟踪的进程的进程号（PID）
+ `addr:`指定操作的内存地址
+ `data:`用于请求的附加数据
+ 返回值通常用于返回提供错误信息

我们以` ptrace(PTRACE_TRACEME, 0, nullptr, nullptr);`的方式使用它，表示该进程应该允许父进程跟踪它。

而`execl`则是众多`exec`风格中的一种，用于替换当前进程的进程映像为一个新的程序，并执行它：

+ `path:`要执行的程序的路径
+ `arg:`程序的第一个参数（通常是程序名）
+ `...:`程序的其他参数，以nullptr结尾

我们以` execl(prog, prog, nullptr);`使用它，表示将当前子进程替换为指定的程序

这样我们就启动了我们的子进程，并将其替换为我们的被调试函数

## 调加调试器的循环

我们启动了子进程，但我们希望能够和它交互，所以我们需要创建一个`debugger`类，并给它一个循环来监听用户的输入，并在我们的父进程中启动它。

```cpp

class debugger{
	public:
		debugger(std::string prog_name,pid_t pid) : m_prog_name{std::move(prog_name)},m_pid{pid} {}
	
		void run();
	private:
		std::string m_prog_name;
		pid_t m_pid;
};
```

同时在父进程中启动它：

```cpp
	}else if(pid >= 1){
		//parent
		std::cout << "启动调试进程" << pid << '\n';
		debugger dbg{prog,pid};
		dbg.run();
	}
```

在我们的`run`函数中，我们需要等待子进程的启动，然后使用linenoise获取输入直到EOF（ctrl+d）

```cpp
void debugger::run(){
	int wait_status;
	auto options = 0;
	waitpid(m_pid,&wait_status,options);	//在指定的子进程结束之前，阻塞当前进程
	char * line = nullptr;
	while ((line = linenoise("Minidbg>>"))!=nullptr){
		handle_command(line);		//用来解析参数，这个函数尚未实现
		linenoiseHistoryAdd(line);	 //将输入添加到输入历史中
		linenoiseFree(line);		//释放输入占用的空间
	}
}
```

当被跟踪的进程启动时，他将收到一个`SIGYTAP`信号，这是一个跟踪或断点信号，我们使用`waitpid`等待这个信号的发送

当我我们直到进程准备号被调试之后，我们监听用户的输入。`linenoise`函数接受一个显示提示，并自行处理用户的输入。我们将输入交给`handle_command`函数处理，然后将输入添加到`lineniose`的历史输入中，并释放分配的空间资源

## 处理输入

我们的调试器支持的命令结构像GDB那样，我们用`continue`或`cont`或`c`来告诉他们继续执行。还有下断点之类的操作，我们用空格来实现对他们的分割：

```cpp
void debugger::handle_command(const std::string& line){
	auto args = split(line,' ');
	auto command = args[0];

	if(is_prefix(command,"continue")){
		continue_execuion();
	}else{
		std::cerr << "未定义的操作"; 
	}
}
```

接下来我们进一步完成`handle_command`的辅助函数`is_prefix`和`split`函数：

```cpp
std::vector<std::string> debugger::split(const std::string& s,char delimiter){
	std::vector<std::string> out{};
	std::stringstream ss {s};
	std::string item;
	while (std::getline(ss,item,delimiter)){	//从输入流中读取，直到分隔符结束读取
		out.push_back(item);
	}
	return out;
}
```

```cpp
bool debugger::is_prefix(const std::string& s,const std::string& of){
	if(s.size() > of.size()) return false;
	return std::equal(s.begin(),s.end(),of.begin());
}
```

最后我们再完成我们的`continue_execution`函数：

```cpp
void debugger::continue_execuion(){
	ptrace(PTRACE_CONT,m_pid,nullptr,nullptr);

	int wait_status;
	auto options = 0;
	waitpid(m_pid,&wait_status,options);
}
```

我们的`continue_execution`将使用`pstrace`告诉进程继续，然后使用`waitpid`直到接受到信号

## 执行流程

到此为止，我们初步的框架就完成了，我们可以整理一下整个程序的执行流程

1. 首先我们接受到两个参数`./minigdb test`
2. 程序运行到`fork`会创建一个新的进程，我们将父进程作为调试器进程，将子进程作为被调试的进程
3. 子进程因为`ptrace(PTRACE_TRACEME,0,nullptr,nullptr);`会等待父进程发出调试信息，才开始执行
4. 父进程开始执行`run()`，其中`waitpid`会等待子进程的结束，但是由于此时子进程还在等待父进程的调试信息，还没有开始执行，所以父进程开始执行命令`c`
5. 此时父进程调用了`ptrace(PTRACE_CONT, m_pid, nullptr, nullptr)`向子进程发出了继续执行的命令。且使用`waitpid`等待子进程的结束，并重新回到读取输入的循环

整个过程使用`ptrace`和`waitpid`实现了控制父子进程的协同运行

我们可以看下程序的运行效果：

![image.png](https://s2.loli.net/2025/05/08/3sLP9SwojtfWBah.png)

符合我们的设计，那么调试器的准备阶段就到此为止了

