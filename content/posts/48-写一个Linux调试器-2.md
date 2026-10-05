---
title: 写一个Linux调试器(2)
date: 2025-05-08 16:36:58
series: "写一个 Linux 调试器"
weight: 2
---

昨天写了一些基本的架构，写到一半我突然有很多灵感，为什么一定要按照教程的内容去做呢。我应该有自己的想法，而且我现在也有能力去实现，有错误也可以慢慢调试。再加上AI的帮助，我可以以这个教程为蓝本，学习各种知识。

所以现在我要从头开始尝试这个过程，OK基本上自己重新实现了一遍，优化了一些功能和拓展了一些程序。接下来需要进一步学习怎么制作一个断点，这个还是要老老实实学原理了 

# 断点

## 怎么生成一个断点

程序中的断点，在我们调试代码时，使程序停止到指定位置。但是这是什么原理呢？首先程序的断点分为两种：一种是软件断点，还有一种是硬件断点。这里我们使用的是软件断点，接下来我们研究，断点是怎么生成的？

这里我们使用x86的内置的中断操作`int 3`，这个操作会向程序发出信号。在现代操作系统中，当处理器执行到`int 3`时，会触发一个`SIGTRAP`信号，通知我们的调试程序。当然，如果我们想要实现一个断点，我们就需要在指定位置修改内存，将内存覆盖为`int 3`，然后运行，触发中断，等执行完这个断点之后，我们再将原来的内存覆写回来。

下面这张图很好的展现了这个过程，我们按照这个原理来实现断点的生成:

![image.png](https://s2.loli.net/2025/05/09/qKp8RhFjYtArecS.png)

但是，这里我们怎么利用系统发出的`SIGTRAP`信号，来通知我们的调试进程，断点的发生呢。我们可以使用`waitpid`来实现，设置断点，程序执行，调用`waitpid`等待`SIGTRAP`的信号发生。然后可以将断点信息传给用户。

## 实现程序断点

首先我们设置一个断点的类，方便我们的设置和使用。

```cpp
class breakpoint{
	public:
		breakpoint (pid_t pid, std::intptr_t addr) : m_pid(pid),m_addr(addr),m_enable(false),m_saved_data(0) {}
		//启用禁用
		void enable();
		void disable();
		//检查启用
		auto is_enable() const->bool {return m_enable;}
		//获取地址
		auto get_address() const->std::intptr_t {return m_addr;} 

	private:
		pid_t m_pid;
		std::intptr_t m_addr;
		bool m_enable;
		uint8_t m_saved_data;	//用来存储被覆盖的函数
};
```

这里主要是用于跟踪存储断点的状态，断点设置的主要实现还是在`enable`和`diable`中，我们来尝试实现他们:

```cpp
void breakpoint::enable(){
	auto data = ptrace(PTRACE_PEEKDATA,m_pid,m_addr,nullptr);	 //返回的data是64位
	m_saved_data = static_cast<uint8_t> (data & 0xff);			//8位是用来存储64位信息的最低位数据
	uint64_t int3 = 0xcc;									  //64位的int3方便对齐
	uint64_t data_with_int3 = ((data & ~0xff) | int3);
	ptrace(PTRACE_POKEDATA,m_pid,m_addr,data_with_int3);

	m_enable = true;
}

void breakpoint::disable(){
	auto data = ptrace(PTRACE_PEEKDATA,m_pid,m_addr,nullptr);
	auto restore_data = ((data & ~0xff) | m_saved_data);
	ptrace(PTRACE_POKEDATA,m_pid,m_addr,restore_data);

	m_enable = false;
}
```

这里我们用到的原理是使用`PTRACE_PEEKDATA`的请求到`ptrace`，给定指定的进程和内存地址，会返回该地址前的一个64位的数据。我们先将要被覆盖的地址保存下来，然后将`int3`的数据`0xcc`覆写上去，然后使用`PTRACE_POKEDATA`请求，将内容覆写会程序的内存中，从而实现了断点的设置。取消断点则反之，将数据恢复后再写会去。这个过程中一定要注意内存地址的对齐，不要覆盖错了位置。

## 添加到调试器中

我们已经简单的实现了断点的方法和属性，接下来我们将其添加到调试器中，来实现我们对程序的控制，我们需要做到以下几点：

+ 在debugger类中添加存储断点信息的数据结构
+ 创建一个方法函数用来设置断点`set_breakpoint_at_address`
+ 修改我们的`handle_cammand`函数，使其支持断点操作

```cpp
class debugger{
	public:
   		...
		//设置断点
		void set_breakpoint_at_address(std::intptr_t addr);

  	private:
		...
		std::unordered_map<std::intptr_t,breakpoint> m_breakpoint;
};
```

首先添加新的属性和函数到程序调试器中，我们使用哈希表`unoredered_map`，以地址作为键，以断点作为值进行存储。

然后我们创建一个函数用来设置我们的断点`set_breakpoint_at_adress`:

```cpp
void debugger::set_breakpoint_at_address(std::intptr_t addr){
	std::cout << "设置断点到 " << std::hex << addr << "处"<< std::endl;
	breakpoint bp {m_pid,addr};
	bp.enable();
	m_breakpoint[addr] = bp;	//存储断点信息
}
```

然后我们修改我们的命令行处理函数：

```cpp
void debugger::handle_command(const std::string& line){
	if(line.empty()){
		return;
	}
	auto args = split(line,' ');
	auto command = args[0];
	if(is_prefix(command,"continue")){
		...
	}else if(is_match(command,"exit")){
		...
	}else if(is_prefix(command,"breakpoint")){
		std::string addr {args[1],2};						//去除16进制数据前的0x
		set_breakpoint_at_address(std::stol(addr,0,16));	  //从数据的开头开始按十六进制转换成intptr_t可读的长整数
	}else{
		...
	}
}
```

至此为止，我们的断点就设置完成啦

## test test test

让我们试试能不能正常的使用，虽然我们现在只能设置断点，还不能正常的执行它，也不能取消它，我们可以看一看它的表现：

![image.png](https://s2.loli.net/2025/05/10/LmoaV3FTpNKk4MS.png)

现在我们希望将断点下在程序的`call pmem`处，由于地址的空间随机化，我们在objdump 中只能看到指令的偏移地址，但是我们可以通过进程的内存映射找到程序的加载入口，我们可以计算出`0x558b09f02000+0x16bb`就是我们要下断点的位置。

看一看效果：

![image.png](https://s2.loli.net/2025/05/10/Rl4FKWDTmSkEVnM.png)

非常成功！

不过由于我们还没有编写能够终止断点的函数，所以程序到这里就直接停下来了，我们之后再来完善
