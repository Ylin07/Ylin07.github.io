---
title: 8086CPU_learning(10)
date: 2025-01-30 8:23:28
series: "8086 CPU 学习"
weight: 10
---

马上过年了，这几天要么在帮忙，要么在玩。今天是年三十，上午没什么事，我要好好学一下。



# 外中断

## 外中断信息

有一种中断信息，来自于CPU的外部，当CPU外部有需要处理的事情发生的时候。比如说，外设的输入到达，芯片会向CPU发出相应的中断信息。CPU在执行完当前的指令后，可以检测发送过来的中断信息，引发中断过程，处理外设的输入

在PC中，外中断源一共有以下两类：

1. 可屏蔽中断

   可屏蔽中断是CPU可以不响应的外中断。CPU是否可以响应可屏蔽中断，要看标志位寄存器IF的位的设置。当CPU检测到可屏蔽中断信息是，如果IF = 1，则CPU在执行完当前指令后响应中断，引发中断；如果IF= 0，则不响应可屏蔽

   可屏蔽中断程序的所引发的中断过程，基本和内中断的中断过程相同。因为可屏蔽中断信息来自于CPU外部，中断类型码通过数据总线送入CPU；而内中断的中断类型码在CPU内产生的

   现在，我们可以解释中断过程中将IF置为0的原因了。将IF置为0的原因就是，在进入中断和程序之后，禁止其他的可屏蔽中断。如果在中断过程中需要处理可屏蔽中断，可以用指令将IF置1。。8086CPU提供的设置IF的指令如下：

   + `sti,设置IF = 1`
   + `cli,设置IF = 0`

2. 不可屏蔽中断

   不可屏蔽中断时CPU必须响应的外中断。当CPU检测到不可屏蔽中断信息时，则在执行完当前命令后，立即响应，并引发中断过程

   对于8086CPU，不可屏蔽中断的中断类型码固定为2，所以中断过程中，不需要取中断类型码，而是直接触发。不可屏蔽中断的中断过程为：

   + 标志寄存器入栈，IF=0,TF=0
   + CS,IP入栈
   + (IP) = (8)，（CS）= (0AH)

几乎所有的外设引发的外中断，都是可屏蔽中断。当外设有需要处理的事件时（比如说键盘输入）发生时，相关芯片向CPU打出可屏蔽中断信息。不可屏蔽中断时在系统中有必须处理的紧急情况发生时用来通知CPU的中断信息

## PC机的键盘处理过程

通过键盘的响应过程。我们可以感受一下外设输入的过程

### 键盘输入

键盘上的键相当于开关，键盘中有一个芯片。当按下一个键时，芯片就会产生一个扫描码，扫描码说明了按下的键在键盘上的位置。扫描码被送入主板上的相关接口芯片的寄存器中，该寄存器的端口地址为60h。松开按下的键时，也产生一个扫描码，扫描码说明了松开的键在键盘上的位置。松开时，产生的扫描码也送到端口60h中

+ 通码：按下一个键产生，第7位为0
+ 断码：松开一个键产生，第7位为1

一个扫描码的长度为一个字节，所以有 `断码 = 通码 + 80H`

### 引发9号中断

当键盘的输入到达60H端口时，相关的芯片就会向CPU发出中断类型码为9的可屏蔽中断信息。CPU检测到该中断信息后，如果IF=1，则响应中断，引发中断过程，转去执行`int 9` 中断例程

### 执行 `int 9`中断例程

BIOS提供了int 9中断例程，用来进行基本的键盘输入处理，其工作如下：

1. 读出60h端口中的扫描码
2. 如果是字符键的扫描码，将该扫描码和它所对应的（ASCII码）送入内存中的BIOS键盘缓冲区；如果是控制键（Ctrl）和切换键（CapsLock）的扫描码，则将其转变为状态字节（用二进制位记录控制键和切换状态的字节）写入内存中存储状态字节的单元
3. BIOS键盘缓冲区在系统启动后，用来存放`int 9`中断例程中所接收的键盘输入。该内存区可以存储15个键盘输入，因为 `int 9`中断例程除了接受扫描码外，还要产生对应的字符码。所以在BIOS键盘缓冲区，一个键盘输入用一个字单元存放（高位存放扫描码，低位存放字符码）

关于状态码如下：

![image.png](https://s2.loli.net/2025/01/30/StRZkWY4GL6Qpno.png)

## INT 9例程

### 编写`int 9`例程

我们可以编写新的键盘中断例程，进行一些特殊工作。不过设计到部分的硬件操作细节，不过我们可以通过使用已经编写好的int 9例程覆盖这些操作

比如现在我们需要：在屏幕中间依次显示“a”~"z"，并可以让人看清。在显示的过程中，按下Esc键后改变颜色

我们可以先写出循环打印的程序

``` assembly
assume cs:code
stack segment
    db 128 dup(0)
stack ends

code segment
start:
    mov ax,stack
    mov ss,ax
    mov sp,128

    mov ax,0b800H
    mov es,ax
    mov ah,'a'
s:
    ;显示a-z
    mov es:[160*12+40*2],ah
    call delay  ;因为我们的CPU执行速度太快了，所以需要延迟输出
    inc ah
    cmp ah,'z'
    jna s

    mov ax,4c00h
    int 21h

delay:
    ;延迟函数
    push ax
    push dx
    mov dx,0FH    ;循环F0000h次
    mov ax,0
s1:
    sub ax,1
    sbb dx,0
    cmp ax,0
    jne s1
    cmp dx,0
    jne s1
    pop dx
    pop ax
    ret

code ends
end start
```

接着我们使用int 9中断例程去实现变色

键盘输入到达60h端口后，会引发int 9 中断例程。我们可以编写int 9例程，功能如下：

+ 从60H端口中读出键盘的输入
+ 调用BIOS的int 9中断例程，处理其他硬件细节
+ 判断是否位Esc的扫描码，如果是，改变颜色后返回；如果不是则直接返回

不过如何调用原int 9也是一个问题，在这里我们可以将其入口地址作为我们的函数入口，然后用以下方法模拟调用：

1. 标志寄存器入栈
2. IF=0，TF=0
3. call dword ptr ds:[0]

对于（1），可以使用 `pushf`实现

对于（2），可以用下面的指令实现

```assembly
pushf
pop ax
and ah,11111100B	;IF和TF为标志寄存器的第九位和第八位
push ax
popf
```

则综上的int模拟过程为：

```assembly
pushf
pushf
pop ax
and ah,11111100B	
push ax
popf	;IF=0,TF=0
call dword ptr ds:[0]	;将CS,IP入栈
```

知道原理之后我们可以实现：

```assembly
assume cs:code

stack segment
    db 128 dup(0)
stack ends

data segment
    dw 0,0  ;为原int 9中断例程的调用分配空间
data ends
code segment
start:
    ;栈的初始化
    mov ax,stack
    mov ss,ax
    mov sp,128
    ;拷贝原int 9的中断例程
    mov ax,data
    mov ds,ax
    mov ax,0
    mov es,ax
    push es:[9*4]
    pop ds:[0]
    push es:[9*4+2]
    pop ds:[2]  ;将入口地址保存在当时ds:0~2单元中
    mov word ptr es:[9*4],offset int9
    mov es:[9*4+2],cs
    ;显存初始化
    mov ax,0b800H
    mov es,ax
    mov ah,'a'
s:
    ;显示a-z
    mov es:[160*12+40*2],ah
    call delay  ;因为我们的CPU执行速度太快了，所以需要延迟输出
    inc ah
    cmp ah,'z'
    jna s
    ;恢复例程
    mov ax,0
    mov es,ax
    push ds:[0]
    pop es:[9*4]
    push ds:[2]
    pop es:[9*4+2]

    mov ax,4c00h
    int 21h

delay:
    ;延迟函数
    push ax
    push dx
    mov dx,0Fh    ;循环F0000h次
    mov ax,0
s1:
    sub ax,1
    sbb dx,0
    cmp ax,0
    jne s1
    cmp dx,0
    jne s1
    pop dx
    pop ax
    ret
;------------新的int 9的中断例程-----------------
int9:
    push ax
    push bx
    push es

    in al,60h   ;从60h读出键盘的输入

    pushf
    pushf
    pop bx
    and bh,11111100B
    push bx
    popf 
    call dword ptr ds:[0]   ;对int指令进行模拟，调用原来的int 9中断例程

    cmp al,1
    jne int9ret

    mov ax,0b800H
    mov es,ax
    inc byte ptr es:[160*12+40*2+1] ;将属性值加1,改变颜色
int9ret:
    pop es
    pop bx
    pop ax
    iret
code ends
end start
```

### 安装int 9例程

刚刚是简介使用了原int 9中断例程的功能，现在我安装一个新的int 9中断例程，使得原int9中断例程的功能得到拓展

功能：在DOS下，按F1键后改变当前屏幕的显示颜色，其他键照常处理

在开始之前需要解决几个问题，首先

1. 改变屏幕的显示颜色

改变从B800H开始的4000个字节中的所有奇地址元素中的内容，当前屏幕的显示颜色即发生改变

```assembly
	mov ax,08b00H
	mov es,ax
	mov bx,1
	mov cx,2000
s:
	inc byte ptr es:[bx]
	add bx,2
	loop s
```

2. 其他的都是使用原int9例程处理即可，这里我们还需要调用原int9中断例程，所以需要保存原int9例程的入口地址：

由于安装程序在程序返回之后地址将丢失，所以我们将其保存在0：200后，而我们重写的int9例程，我们也将保存在0：204之后

现在准备就绪，开始编写

```assembly
assume cs:code
stack segment
    db 128 dup (0)
stack ends

code segment
start:
    mov ax,stack
    mov ss,ax
    mov sp,128

    push cs
    pop ds

    mov ax,0
    mov es,ax
    ;安装程序
    mov si,offset int9  ;设置ds:si指向源地址
    mov di,204h         ;设置es:di指向目的地址
    mov cx,offset int9end-offset int9
    cld
    rep movsb

    push es:[9*4]
    pop es:[200H]
    push es:[9*4+2]
    pop es:[202H]

    cli
    mov word ptr es:[9*4],204h
    mov word ptr es:[9*4+2],0
    sti

    mov ax,4c00H
    int 21h

int9:
    push ax
    push bx
    push cx
    push es

    in al,60h
    pushf
    call dword ptr cs:[200h]    ;此时cs=0
    
    cmp al,3bh      ;F1的扫描码为3bH
    jne int9ret

    mov ax,0b800H
    mov es,ax
    mov bx,1
    mov cx,2000
s:
    inc byte ptr es:[bx]
    add bx,2
    loop s
int9ret:
    pop es
    pop cx
    pop bx
    pop ax
    iret
int9end:
    nop
code ends
end start
```



# 实验十五

![image.png](https://s2.loli.net/2025/01/30/XyvdFsqc32JW4j8.png)

很简单，只要在上一个代码的基础上做修改即可

```assembly
assume cs:code
stack segment
    db 128 dup (0)
stack ends

code segment
start:
    mov ax,stack
    mov ss,ax
    mov sp,128

    push cs
    pop ds

    mov ax,0
    mov es,ax
    ;安装程序
    mov si,offset int9  ;设置ds:si指向源地址
    mov di,204h         ;设置es:di指向目的地址
    mov cx,offset int9end-offset int9
    cld
    rep movsb

    push es:[9*4]
    pop es:[200H]
    push es:[9*4+2]
    pop es:[202H]

    cli
    mov word ptr es:[9*4],204h
    mov word ptr es:[9*4+2],0
    sti

    mov ax,4c00H
    int 21h

int9:
    push ax
    push bx
    push cx
    push es

    in al,60h
    pushf
    call dword ptr cs:[200h]    ;此时cs=0
    
    cmp al,9EH      ;判断断码
    jne int9ret

    mov ax,0b800H
    mov es,ax
    mov bx,0
    mov cx,2000
s:
    mov byte ptr es:[bx],'A'	;全屏输出
    add bx,2
    loop s
int9ret:
    pop es
    pop cx
    pop bx
    pop ax
    iret
int9end:
    nop
code ends
end start
```

