---
title: 8086CPU_Learning(9)
date: 2025-01-25 10:10:00
series: "8086 CPU 学习"
weight: 9
---
昨天学的那个太难了，再加上下午一直在玩，今天要赶赶进度



# int 指令

当CPU执行 `int n`指令时，相当于引发一个n号中断的过程，其执行流程如下：

+ 取中断类型码n
+ 标志寄存器入栈，IF = 0，TF = 0
+ CS，IP入栈
+ `(IP) = (n*4)` `(CS) = (n*4+2)`

可以在程序中使用int指令，调用任何一个中断的中断处理程序

比如我们使用这段程序：

```assembly
assume cs:code
code segment
start:
    mov ax,0b800h
    mov es,ax
    mov byte ptr es:[12*160+40*2],'!'
    int 0
code ends
end start
```

当我们运行这段指令之后我执行0号处理程序，然后回到系统

由此，我们可以看出int 和 call指令相似，都是调用一段程序

我们可以实现编译一些子程序，作为中断处理程序，然后用int进行调用，我们把这个称为中断例程

## 编写供应用程序调用的中断例程

书本里面给了两个例题

![image.png](https://s2.loli.net/2025/01/25/yhNmK5lrBHkMPdG.png)

我们在下面给出安装程序

```assembly
assume cs:code
code segment
start: 
    mov ax,cs
    mov ds,ax
    mov si,offset sqr  ;指向源地址
    mov ax,0
    mov es,ax
    mov di,200H
    mov cx,offset sqrend - offset sqr
    cld
    rep movsb

    mov ax,0
    mov es,ax
    mov word ptr es:[7ch*4],200H
    mov word ptr es:[7ch*4+2],0

    mov ax,4c00H
    int 21h

sqr:
    mul ax
    iret	;中断例程的最后使用，退栈CS：IP和标志寄存器
sqrend:
    nop

code ends
end start
```

![image.png](https://s2.loli.net/2025/01/25/neREm3w5MJZpbSF.png)

我们在下面给出安装程序

```assembly
assume cs:code
code segment
start: 
    mov ax,cs
    mov ds,ax
    mov si,offset capital  ;指向源地址
    mov ax,0
    mov es,ax
    mov di,200H
    mov cx,offset capitalend - offset capital
    cld
    rep movsb

    mov ax,0
    mov es,ax
    mov word ptr es:[7ch*4],的
    mov word ptr es:[7ch*4+2],0

    mov ax,4c00H
    int 21h

capital:   
    push cx
    push si
change:
    mov cl,[si]
    mov ch,0
    jcxz ok
    and byte ptr [si],11011111b
    inc si
    jmp short change
ok:
    pop si
    pop cx 
    iret
capitalend:
    nop

code ends
end start
```

因为中断例程用到了si,cx所以我们需要用栈保存

## 对int,iret和栈的深入理解

我们通过一个例子,来实现int,iret,栈的深入了解

![image.png](https://s2.loli.net/2025/01/25/g3NU7LWVbkJjfRF.png)

为了具备loop的功能,7cH中断例程需要具备以下功能:

+ dec cx
+ 如果(cx)!=0,转到s标号执行,否则向下执行

可是怎么实现到目的地的转移到呢?

+ 我们应该设(CS)为s的段地址,(IP)为s的偏移地址
+ 在中断例程开始之后,我们会将s标号的段地址和se的偏移地址压入栈中.此时,我们可以用之前存放在bx中的偏移位移,来得到标号s的偏移地址
+ 接着利用iret指令,我们将栈中的se的偏移地址加上bx中的转移位移,则栈中的偏移地址即变成了s的偏移地址.我们再使用iret指令,用栈中的内容设置CS,IP从而实现了跳转

由此我们可以写出中断例程:

```assembly
lp:
	push bp
	mov bp,sp
	dec cx
	jcxz lpret
	add [bp+2],bx
lpret:
	pop bp
	iret 
```

这需要说明一下,因为我们要访问栈,所以使用了bp.在程序开始前,先将bp入栈保存,结束时再出栈恢复.当要修改栈中se的偏移地址时,栈中的结构是: `栈顶处是bp原来的数值,下面是se的偏移地址,在下面是s的段地址,再下面是标志寄存器`此时bp中为栈顶的偏移地址,所以((ss)*16+(bp)+2)处为se的偏移地址,再加上bx中的偏移位移就变成了s的偏移地址.最后再用iret出栈返回,CS:IP此时为标号s的指令

## BIOS与DOS

### BIOS和DOS提供的中断例程

在系统的ROM中存放了一套程序,称之为BIOS(基本输入输出系统),BIOS中主要包含以下内容:

+ 硬件系统的检测和初始化程序
+ 外部中断和内部中断的中断例程
+ 用于对硬件设备进行I/O操作的中断例程
+ 其他和硬件系统相关的中断例程

操作系统DOS也提供了中断例程,从操作系统的角度来看,DOS的中断例程就是操作系统像程序员提供的一种编程资源

### BIOS和DOS中断例程的安装过程

BIOS和DOS 的中断例程是怎么安装到内存中的呢?

+ 开机后,CPU加电.初始化(CS)=0FFFFH,(IP)=0,自动从FFFF:0单元开始执行程序.在FFFF:0单元有一条跳转指令,CPU执行这个命令之后转去执行BIOS中的硬件系统检测和初始化程序
+ 初始化程序将建立BIOS所支持的中断向量,只需要将BIOS提供的中断例程入口登记在中断向量表中.在这里需要注意,对于BIOS所提供的中断例程,只需要将入口地址登记在中断向量表中,因为他们是被固化在ROM中的程序,一直在内存中存在
+ 硬件系统检测和初始化完成之后,调用 `int 19h`进行操作系统的引导.从此将计算机交由操作系统控制
+ DOS启动后,除完成其他工作之外,还将它所提供的中断例程装入内存中,并建立相应的中断向量

### BIOS中断例程的应用

我们可以使用int 10H中断例程,其包含了多个和屏幕输出相关的子程序.

这里可以看出,一个供程序员调用的中断例程,其中包含了多个子程序,中断例程内部用传递进来的参数来决定执行哪一个子程序.在BIOS和DOS中提供的中断例程,都是用ah来传递内部的子程序的编号

展示以下 `int 10h`中断例程的设置光标位置功能:

```assembly
mov ah,2	;置光标
mov bh,0	;第0页
mov dh,5	;dh中放行号
mov dl,12	;dl中放列号
int 10h
;上面操作的含义是:设置光标到第0页,第5行,第12列
```

关于页号的含义可以看看下方的图片:

![image.png](https://s2.loli.net/2025/01/25/IBNznPmX61MxwJf.png)

我们继续试试`int 10h`中断例程的在光标位置显示字符功能

```assembly
mov ah,9	;在光标位置显示字符
mov al,'a'	;字符
mov bl,7	;颜色属性
mov bh,0	;第0页
mov cx,3	;字符重复个数
int 10H
;含义:在屏幕的第5行12列显示3个红底高亮闪烁绿色的"a"
```

我们编写一个完整的程序来查看效果:

```assembly
assume cs:code
code segment
start:
    mov ah,2
    mov bh,0
    mov dh,5
    mov dl,12
    int 10h

    mov ah,9
    mov al,'a'
    mov bl,11001010b
    mov bh,0
    mov cx,3
    int 10h

    mov ax,4c00H
    int 21h

code ends
end start  
```

非常成功(好耶!!!)

### DOS中断例程的应用

`int 21H`是DOS提供的中断例程,其中包含了DOS提供给程序员编程时调用的子程序

比如我们常用的:

```assembly
mov ah,4ch	;程序返回
mov al,0	;程序返回值
int 21h
```

我们来试试另外的用法:在光标位置显示字符串的功能

```assembly
;ds:dx指向字符串	;要显示的字符串需要用"$"作结束符
mov ah,9		;功能号9,表示在光标位置显示字符串
int 21h
```

我们来试试效果

```assembly
assume cs:code
data segment
    db 'I love you my baby','$' ;$本身并不输出,只是起到边界作用
code segment
start:
    mov ah,2
    mov bh,0
    mov dh,5
    mov dl,12
    int 10h

    mov ax,data 
    mov ds,ax
    mov dx,0
    mov ah,9
    int 21H

    mov ax,4c00H
    int 21h

code ends
end start  
```

DOS为程序员提供了许多可以调用的子程序,包含在`int 21H`中断例程中.可以自行了解



# 端口

在PC机种，和CPU通过总线相连接的芯片除了各种储存器以外，还有以下3种芯片：

+ 各种接口卡（显卡，网卡）上的接口芯片，它们控制接口卡进行工作
+ 主板上的接口芯片，CPU通过它们对部分外设进行访问
+ 其他芯片，用来存储相关的系统信息，或进行相关的输入输出处理

在这些芯片种，都有一组可以由CPU读写的寄存器，这些寄存器有以下共同点：

+ 都和CPU的总线相连接，当然这种连接都是通过他们所在的芯片进行的
+ CPU对他们进行读写的时候都通过控制线向他们所在的芯片发出端口读写命令

所以，从CPU的角度，将这些寄存器当作端口，对他们进行统一编址，从而建立一个统一的端口地址空间。每一个端口在地址空间都有一个地址

CPU可以直接读写这三个地方的数据：

+ CPU内部的寄存器
+ 内存单元
+ 端口

## 端口的读写

在访问端口时，CPU通过端口地址来定位端口。因为端口所在的芯片和CPU通过总线相互连接，所以，端口地址和内存地址一样，通过地址总线来传送。在PC中CPU最多可以定位64KB个不同的端口，即端口的地址范围为0~65535

访问端口的命令只有两条 `in` 和 `out`，我们分析下面的例子：

```assembly
in al,60H	;从60H号端口读入一个字节
```

注意，在`in` 和 `out`指令中，只能使用ax和al来存放从端口中读入的数据或要发送到端口中的数据

+ 访问8位端口要用al
+ 访问16位端口要用ax

## CMOS RAM芯片

我们通过一个芯片的例子来详细的体会一下对端口的访问

这个芯片的特征如下：

+ 包含一个实时钟和一个有128个存储单元的RAM存储器
+ 该芯片靠电池供电。所以，关机后其内部的实时钟仍可以正常工作，RAM中的信息也不会丢失

芯片的作用如下：

+ 128个字节的RAM中，内部实时钟占用0~0DH单元来保存时间信息，其余大部分单元用于保存系统配置信息，供系统启动时BIOS程序读取。BIOS也提供相关的程序，使我们可以在开机的时候配置CMOSRAM中的系统信息
+ 该芯片有两个端口，端口地址为70H和71H，CPU通过这两个端口来读写CMOSRAM。其中70H为地址端口，存放要访问的CMOS的单元地址；71H为数据端口，存放选定的CMOS单元中读取的数据，或要写入其中的数据

也就是说CPU对CMOS的读写要分两步进行。比如，读CMOS的2号单元

1. 将2送入端口70H
2. 从端口71H读出2号单元的内容

## shl和shr指令

他们两个是逻辑移位指令

他们的使用方法为

```assembly
shl/shr 二进制数据,见下面的分类
;如果只是移动一位
shl al,1
;如果移动的不止一位,则将移动的次数放在cl中
mov cl,N
shl al,cl
```

### shl

shl是逻辑左移指令，它的功能为：

+ 将一个寄存器或内存单元中的数据向左移位
+ 将最后移除的一位写为CF中
+ 最低位用0补充

将X逻辑左移一位相当于进行： `X=X*2`

### shr

shr是逻辑右移指令，它的功能为：

+ 将一个寄存器或内存单元中的数据项右移位
+ 将最后移除的一位写入CF中
+ 最高位用0补充

将X逻辑右移一位相当于进行：`X=X/2`

这里举个例子，将10100100B左移三位

```
原数据：	10100100
左移后：  10100100		CF =1
最低位用0补充：00100000
```

## CMOS RAM中存储的时间信息

这里有一个编程任务

![image.png](https://s2.loli.net/2025/01/25/4WRuSAgNs9Y2Pcw.png)

实现这个功能，我们需要分成两个步骤进行：

+ 从CMOSRAM中的8号单元读出当前月份的BCD码
+ 将用BCD码表示的月份以十进制的形式显示到屏幕上

关键在于怎么将BCD值转换为十进制数对应的ASCII码，这里我们可以用刚刚提到的逻辑位移实现

```assembly
assume cs:code 
code segment
start:
    ;从CMOS中单读出当前的月份的BCD码
    mov al,8
    out 70h,al
    in al,71h
    ;分离BCD码
    mov ah,al
    mov cl,4
    shr ah,cl
    and al,00001111b
    ;转换为ASCII码
    add ah,30H
    add al,30H
    ;显示
    mov bx,0b800H
    mov es,bx
    mov byte ptr es:[160*12+40*2],ah    ;显示十位数码
    mov byte ptr es:[160*12+40*2+2],al  ;显示个位数码

    mov ax,4c00H
    int 21H
code ends
end start
```



# 实验十四 

![image.png](https://s2.loli.net/2025/01/25/UJQmCdLDBA9arsP.png)

```assembly
assume cs:code 
data segment
    db '00/00/00 00:00:00','$'
    db 9,8,7,4,2,0
data ends
stack segment
    dw 8 dup(0)
stack ends
code segment
start:
    ;初始化
    mov ax,stack
    mov ss,ax
    mov sp,16
    mov ax,data
    mov ds,ax
    mov si,0
    mov cx,6
    mov bx,12H
    ;从CMOS中单读出当前的月份的BCD码
s:  
    mov al,[bx]
    out 70h,al
    in al,71h
    call go 
    inc bx
    loop s

    ;字符显示
    mov ax,data 
    mov ds,ax
    mov dx,0
    mov ah,9
    int 21H

    mov ax,4c00H
    int 21H

go:   
translation:
    ;分离BCD码
    push cx
    mov ah,al
    mov cl,4
    shr ah,cl
    and al,00001111b
    ;转换为ASCII码
    add ah,30H
    add al,30H
input:
    ;存入
    mov byte ptr ds:[si],ah    ;显示十位数码
    mov byte ptr ds:[si+1],al  ;显示个位数码
    add si,3
    pop cx
    ret

code ends
end start
```

