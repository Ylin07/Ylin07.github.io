---
title: 写一个Linux调试器(3)
date: 2025-05-10 15:34:51
series: "写一个 Linux 调试器"
weight: 3
---
上次把断点基本的设置搞完了，接下来需要进一步的对寄存器进行操作。我们将添加读取和写入寄存器和内存的功能，这样我们就可以操作程序寄存器(PC)，从而实现程序状态的观察和操作。

# 寄存器和内存

## 寄存器结构

我们需要建立x86_64架构寄存器的元数据，以便通过`ptrace`系统调用和`DWARF`调试信息于寄存器交互

首先我们需要明确我们需要用到的寄存器，我们主要使用一些比较常用的寄存器，忽略对于架构非必须的寄存器，我们先创建一个寄存器强类型枚举，用于确定我们要用到的寄存器

```cpp
enum class reg {
	rax,rbx,rcx,rdx,
	rdi,rsi,rbp,rsp,
	r8,r9,r10,r11,
	r12,r13,r14,r15,
	rip,rflags,cs,
	orig_rax,fs_base,
	gs_rax,
	fs,gs,ss,ds,es
};

constexpr std::size_t n_registers = 27;	//constexpr用来优化编译
```

接下来我们来建立一下寄存器的描述结构，方便我们存储信息：
```cpp
struct reg_descriptor {
	reg r;
	int dwarf_r;
	std::string name;
};
```

然后我们要设置一个全局寄存器描述符数组，其元素顺序需要和`ptrace`返回的寄存器结构的顺序一样，这样便于我们直接通过数组索引直接访问`ptrace`返回的结构字段。

![image.png](https://s2.loli.net/2025/05/10/qmaCpHwyZu8iQ1n.png)

```cpp
const std::array<reg_descriptor,n_registers> g_register_descriptors{{
	{reg::r15,15,"r15"},
	{reg::r14,14,"r14"},
	{reg::r13,13,"r13"},
	{reg::r12,12,"r12"},
	{reg::rbp,6,"rbp"},
	{reg::rbx,3,"rbx"},
	{reg::r11,11,"r11"},
	{reg::r10,10,"r10"},
	{reg::r9,9,"r9"},
	{reg::r8,8,"r8"},
	{reg::rax,0,"rax"},
	{reg::rcx,2,"rcx"},
	{reg::rdx,1,"rdx"},
	{reg::rsi,4,"rsi"},
	{reg::rdi,5,"rdi"},
	{reg::orig_rax,-1,"orig_rax"},
	{reg::rip,-1,"rip"},
	{reg::cs,51,"cs"},
	{reg::rflags,49,"eflags"},
	{reg::rsp,7,"rsp"},
	{reg::ss,52,"ss"},
	{reg::fs_base,58,"fs_base"},
	{reg::gs_base,59,"gs_base"},
	{reg::ds,53,"ds"},
	{reg::es,50,"es"},
	{reg::fs,54,"fs"},
	{reg::gs,55,"gs"},
}};
```

中间的各种数字是对应的`DWARF`寄存器编号，你可以在这里找到他们[psABI-x86_64.pdf](https://www.uclibc.org/docs/psABI-x86_64.pdf)

## 寄存器内容读取

现在我们可以尝试编写一些函数用来和寄存器交互。我们希望能够读取寄存器、向寄存器中写入数据、从`DWARF`寄存器编号中检索值，以及按名称查找寄存器。总之我们先实现一个函数用来读取`get_register_value`的值开始。

我们还是通过`ptrace`的`PTRACE_GETREGS` 实现对寄存器数据的访问。我们用一个`user_regs_struct`的类型来存储`ptrace`的返回值。

```cpp
uint64_t get_register_value(pid_t pid,reg r) {
	user_regs_struct regs;
	ptrace(PTRACE_GETREGS,pid,nullptr,&regs);
	auto it = std::find_if(
			begin(g_register_descriptors),	//全局标识符的起点
			end(g_register_descriptors),	//全局标识符的终点
			[r](const reg_descriptor & rd){return rd.r==r;}//lambda表达式用来匹配条件
	);
    // 本质上是*(ptr + offset)
	return *(reinterpret_cast<uint64_t*>(&regs) + (it - begin(g_register_descriptors)));
}
```

这里我们之所以把传递的`user_regs_struct`结构按`uint64_t`的类型理解，因为这样是安全的，返回的`user_regs_struct`在内存上是连续分布的，我们可以将它按`uint64_t`的类型处理。

现在我们可以获取`regs`中的任意的指定寄存器的值了。

接着我们编写`set_register_value`的函数实现，和刚刚差不多的过程：

```cpp
void set_register_value(pid_t pid,reg r,uint64_t value){
	user_regs_struct regs;
	ptrace(PTRACE_GETREGS,pid,nullptr,&regs);
	auto it = std::find_if(
			begin(g_register_descriptors),
			end(g_register_descriptors),
			[r](const reg_descriptor & rd){return rd.r==r;}
	);
	*(reinterpret_cast<uint64_t*>(&regs) + (it - begin(g_register_descriptors))) = value;
	ptrace(PTRACE_SETREGS,pid,nullptr,&regs);	//返回regs表
}
```

然后再拓展一下，刚刚是根据枚举变量进行查找，现在我们还可以根据`DWARF`值查找，或者根据寄存器名进行查找：

```cpp
uint64_t get_register_from_dwarf_register(pid_t pid,unsigned regnum){
	auto it = std::find_if(
			begin(g_register_descriptors),
			end(g_register_descriptors),
			[regnum](const reg_descriptor & rd){return rd.dwarf_r == regnum;}			
	);
	return get_register_value(pid,it->r);
}

std::string get_register_name(reg r){
	auto it = std::find_if(
			begin(g_register_descriptors),
			end(g_register_descriptors),
			[r](const reg_descriptor & rd){return rd.r == r;}
	);
	return it->name;
}

reg get_register_from_name(const std::string & name){
	auto it = std::find_if(
			begin(g_register_descriptors),
			end(g_register_descriptors),
			[name](const reg_descriptor & rd){return rd.name == name;}
	);
	return it->r;
}
```

这里中间有个辅助函数`get_register_name`可加可不加。

现在我们开始获取我们寄存器中的信息了！

## 操作寄存器

首先我们向调试器加入一个`dump_register`函数，用来获取我们的寄存器信息：

```cpp
void debugger::dump_register(){
	for(const reg_descriptor& rd: g_register_descriptors){
        //输出格式 [reg_name] [0x0000000000000000]
		std::cout << rd.name << " 0x" << std::setfill('0') << 
         std::setw(16) << std::hex << 
         get_register_value(m_pid,rd.r) << std::endl;
	}
}
```

我们修改`handle_command`函数，将我们的读写寄存器的操作功能加入进去

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
	}else if(is_prefix(command,"register")){
		if (is_prefix(args[1],"dump")){
			dump_register();			
		}else if(is_prefix(args[1],"read")){
			std::cout << args[2] << " = " << get_register_value(m_pid,get_register_from_name(args[2])) << std::endl;	
		}else if(is_prefix(args[1],"write")){
			std::string val {args[3],2};
			set_register_value(m_pid,get_register_from_name(args[2]),std::stol(val,0,16));
			std::cout << "0x" << val << " -> " << args[2] << std::endl;
		}
	}else{
		...
	}
}
```

## 操作内存

不像寄存器那么复杂，我们直接使用`ptrace`系统调用就可以进行对程序内存的读写，在这里我们将函数封装起来：

```cpp
uint64_t debugger::read_memory(uint64_t address){
	return ptrace(PTRACE_PEEKDATA,m_pid,address,nullptr);
}

void debugger::write_memory(uint64_t address,uint64_t value){
	ptrace(PTRACE_POKEDATA,m_pid,address,value);
}
```

这里我们使用`ptrace`一次只能传递64位的信息，如果你想要传递更多的信息可以通过系统调用`process_vm_readv` 、 `process_vm_writev`来实现这个功能，我们将内存操作添加到我们的`handle_command`函数中

```cpp
	}else if(is_prefix(command,"memory")){
		std::string addr {args[2],2};
		if(is_prefix(command,"read")){
			std::cout << args[2] << " (mem)" << " = " << std::hex << read_memory(std::stol(addr,0,16)) << " (mem)" << std::endl;
		}else if(is_prefix(command,"write")){
			std::string val {args[3],2};
			write_memory(std::stol(addr,0,16),std::stol(val,0,16));
			std::cout << args[3] << " -> " << args[2] << " (mem)" << std::endl;
		}
    }
```

OK !!!

## 退出断点（完善我们的continue_exection）

我们的程序在执行到断点之后，没办法执行下去了，这是因为我们原来在执行`int 3`之后，pc计数器向后移动了1个字节，我们之前无法重新设置它，所以程序会停止在那里，但是现在可以了。我们可以通过获取并修改`pc`的值，将保存的数据重新覆写，以实现程序的继续运行。我们在执行时可以检查我们的断点映射，看看我们是否处于断点。如果是，我们可以取消断点，并继续执行。

首先我们先添加几个辅助函数，将它们封装起来以提高清晰和简洁性：

```cpp
uint64_t debugger::get_pc(){
	return get_register_value(m_pid,reg::rip);
}

void debugger::set_pc(uint64_t pc){
	set_register_value(m_pid,reg::rip,pc);
}
```

我们先设置一个操作来读取`pc`的值，便于后面的操作，这里我们设置一个操作用来实现断点后的执行

```cpp
void debugger::step_over_breakpoint(){
	auto possible_breakpoint_location = get_pc() - 1;				//pc执行断点后增加了一个字节
	if(m_breakpoint.count(possible_breakpoint_location)){
		auto &bp = m_breakpoint[possible_breakpoint_location];
		if(bp.is_enable()){
			auto previous_instruction_address = possible_breakpoint_location;
			set_pc(previous_instruction_address);
			bp.disable();
			ptrace(PTRACE_SINGLESTEP,m_pid,nullptr,nullptr);		//单步执行
			wait_for_signal();									 
			bp.enable();
		}
	}
}
```

首先我们判断有没有断点，如果有，我们就退回到下断点之前，禁用它，并单步执行原始指令。然后，再把断点重新启用（我一开始也很疑惑为啥呀重新启用呢，这里我忽略了循环的情况）

这里有个`wait_for_signal`实际上这是我们对`waitpid`的封装：

```cpp
void debugger::wait_for_signal(){	//等待子进程执行结束
	int wait_status;
	auto options = 0;
	waitpid(m_pid,&wait_status,options);
}
```

现在我们可以重写我们的`continue_execution`函数了：

```cpp
void debugger::continue_execution(){
	step_over_breakpoint();
	ptrace(PTRACE_CONT,m_pid,nullptr,nullptr);
	wait_for_signal();
}
```

这样很好呀

## 测试

试了一下断点和查看寄存和内存的功能，能正常使用，不错：

![image.png](https://s2.loli.net/2025/05/13/iVrdkI8sbh2WCp3.png)
