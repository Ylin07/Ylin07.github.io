---
title: 8086CPU_Learning(6)
date: 2025-01-22 19:00:12
series: "8086 CPU 学习"
weight: 6
---

今天继续学习汇编语言



# 转移指令的学习

## jmp指令

使用jmp指令需要给出两种信息：

+ 转移的目标地址
+ 转移的距离（段间转移，段内转移，段内近转移）

### 根据位移进行的jmp指令

先对两种jmp进行介绍：

```assembly
jmp short 标号
```

功能为：（IP）=（IP）+ 八位位移（short指明）

+ 8位指令=标号处的地址-jmp指令后的第一个字节的地址
+ 八位位移的范围是-128~127
+ 位移值是在编译程序的过程中计算出来的

```assembly
jmp near ptr 标号
```

功能为：（IP）=（IP） + 十六位位移（near ptr）

+ 16位指令=标号处的地址-jmp指令后的第一个字节的地址
+ 十六位位移的范围是-32768~32767
+ 位移值是在编译程序的过程中计算出来的

我们可以通过下面的图片理解位移的计算过程：

![image.png](https://s2.loli.net/2025/01/22/VED8Aa73SzdgfJw.png)

### 指定转移目的地址的jmp指令

```assembly
jmp far ptr 标号
```

far ptr指明了指令用标号的段地址和偏移地址修改CS和IP

其机器码表现形式为指定目的地址

### 转移地址在寄存器中的jmp指令

```assembly
jmp (16位reg)
```

功能：（IP）= （16位reg）

### 转移地址在内存中的jmp指令

```assembly
jmp word ptr 内存单元地址（段内转移）
```

功能：从内存单元地址处开始存放一个字，是转移的目的偏移地址

```assembly
jmp dword ptr 内存单元地址（段间转移）
```

功能：从内存单元地址处开始存放着两个字，高地址存放的字是转移的目的段地址，低地址是转移的目的偏移地址

+ (CS) = (内存单元地址+2)
+ (IP) = （内存单元地址）

## jcxz指令

有条件转移指令，所有的有条件转移指令都是短转移，在对应的机器码中包含转移的位移，而不是目的地址，对IP修改范围为-128~127

```assembly
jcxz 标号
```

功能：当（cx）= 0 时，转移到标号处执行

+ 8位位移=标号处的地址-jcxz指令后的第一个字节的地址
+ 八位位移的范围是-128~127
+ 位移值是在编译程序的过程中计算出来的

可以理解为

```c
if((cx)==0) jmp short 标号;
```

## loop 指令

所有的循环指令都是短转移，在对应的机器码中包含转移的位移，而不是目的地址

我们在之前学习过，可以理解为

```c
(cx)--;
if((cx)!=0)jmp short 标号;
```

## 根据位移进行转移的意义

因为程序段在不同的机器中内存情况并不一样，如果指定内存地址进行跳转会发生错误

但如果根据位移进行索引，便可以准确的找到位置

**地址间的相对关系是不会改变的**

当然如果位移距离超出范围，会造成编译错误

## offset

我们可以通过 

```assembly
offset 标号
```

取到标号的偏移地址



# 实验九

参考链接：[王爽《汇编语言》(第三版)实验9解析 - nojacky - 博客园 (cnblogs.com)](https://www.cnblogs.com/nojacky/p/9497704.html)

```assembly
assume cs:code
data segment
    db '!!!HelloWorld!!!'
    db 2,36,113
data ends
stack segment
    db 16 dup (0)
stack ends
code segment 
start:
    ;指向data单元
    mov ax,data
    mov ds,ax
    ;指向显存区域
    mov ax,0B800H
    mov es,ax
    ;设置栈段
    mov ax,stack
    mov ss,ax
    mov sp,16
    ;初始化
    mov bx,780H;这个是第十二行的位置
    mov si,16

    mov cx,3
s:
    mov ah,ds:[si]
    push cx
    push si

    mov cx,16
    mov si,64;这个确保居中显示
    mov di,0

s0:
    mov al,ds:[di]
    mov es:[si+bx],al
    mov es:[si+bx+1],ah

    add si,2
    add di,1

    loop s0

    pop si
    pop cx

    add si,16
    add bx,0A0H
    loop s

    mov ax,4c00h
    int 21h

code ends 
end start 
```

效果图

![4ad49d42c593958a5834364a12d92ea8.png](https://s2.loli.net/2025/01/22/ci7LEwvhdYzMbyV.png)



# CALL和RET指令

## ret与retf

ret指令用栈中的数据，修改IP的内容，从而实现近转移
retf指令用战中的数据，修改CS和IP的内容，从而实现远转移

CPU执行ret：
```C
(IP) = ((ss)*16 + (sp))
(sp) = (sp) + 2		//pop IP
```

CPU执行retf：

```C
(IP) = ((ss)*16 + (sp))
(sp) = (sp) + 2		//pop IP
(CS) = ((ss)*16) + (sp)
(sp) = (sp) + 2		//pop CS
```

## call指令

总结一下就是：

+ 将当前的IP或CS和IP压入栈中
+ 转移

### 依据位移进行的call指令

```assembly
call 标号;将当前的IP压入栈中，转到标号处执行指令
```

执行过程如下：

```C
(sp) = (sp) -2
((ss)*16 + (sp)) = (IP)
(IP) = (IP) + 16位位移    
```

位移的计算同上

### 转移到目的地址在call指令中

```assembly
call far ptr 标号
```

相当于进行

```assembly
push CS
push IP
jmp far ptr 标号
```

### 转移地址在寄存器中的call指令

```assembly
call (16位reg)
```

相当于进行

```assembly
push IP
jmp (16位reg)
```

### 转移地址在内存中的call指令

（1）单字节索引

```assembly
call word ptr 内存单元地址
```

相当于进行：

```assembly
push IP
jmp word ptr 内存单元地址
```

（2）双字节索引

```assembly
call dword ptr 内存单元地址
```

相当于进行

```assembly
push CS 
push IP
jmp dword ptr 内存单元地址
```

## 使用

在学会ret和call的用法之后，我们可以使用下面的框架来模拟函数的调用

```assembly
assume cs:code
code segment
main:
	...
	call sub1
	...
	mov ax,4c00h
	int 21h
sub1:
	...
	call sub2
	...
	ret
sub2:
	...
	ret
code ends
end main
```

## mul指令

使用mul指令时，我们需要注意以下几点：

+ 两个相乘的数要么都是八位，要么都是16位。如果是八位，则一个放在AL中，另一个在8位的reg或内存字节单元中;如果是16位，则一个在AX中，一个在16位的reg或者内存字单元中
+ 如果是八位乘法，结果放在AX中；如果是十六位乘法，结果高位放在DX中，低位放在AX中

```assembly
mul reg/内存单元
```



# 实验十：编写子程序

## 显示字符串

![image.png](https://s2.loli.net/2025/01/22/zWeC4BFQoK2J6lv.png)

```assembly
assume cs:code
data segment
    db 'Welcome to masm!',0
data ends

code segment
start:
    ;指向显存
    mov ax,0B800H
    mov es,ax
    
    mov dh,8
    mov dl,3
    mov cl,2
    mov ax,data
    mov ds,ax
    mov si,0
    call show_str

    mov ax,4c00h
    int 21h

show_str:
    mov bx,8*160
    mov di,3*2
    mov ah,cl
    mov cx,16
s:   
    mov al,ds:[si]
    mov es:[bx+di],al
    mov es:[bx+di+1],ah
    inc si
    add di,2
    loop s
    ret

code ends
end start
```

## 解决除法溢出问题

> tips:
>
> 公式 `X/N = int(H/N)*65536 + [rem(H/N)*65536+L]/N`
>
> X：被除数，范围[0,FFFFFFFF]
> N：除数，范围[0,FFFF]
> H：X的高16位，范围[0,FFFF]
> L：X的低16位，范围[0,FFFF]
> int()：取商
> rem()：取余

参考链接：[汇编语言（王爽第三版）实验10：编写子程序 - 筑基2017 - 博客园 (cnblogs.com)](https://www.cnblogs.com/Base-Of-Practice/articles/6883929.html)

![image.png](https://s2.loli.net/2025/01/22/3vF7fQTbqUMNKha.png)

```assembly
assume cs:code
stack segment
    dw 0,0,0,0,0,0,0,0
stack ends
code segment
start:
    mov ax,stack
    mov ss,ax
    mov sp,16

    mov ax,4240H
    mov dx,000FH
    mov cx,0AH
    call divdw
    mov ax,4c00h
    int 21h

divdw:
    push ax
    mov ax,dx
    mov dx,0
    div cx
    mov bx,ax

    pop ax
    div cx
    mov cx,dx
    mov dx,bx
    ret

code ends
end start
```

## 数值显示

![image.png](https://s2.loli.net/2025/01/22/clMHDhJRgmAP8dq.png)

暂时写不出来
