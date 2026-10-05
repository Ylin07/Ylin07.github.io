---
title: 8086CPU_Learning(5)
date: 2025-01-21 21:01:39
series: "8086 CPU 学习"
weight: 5
---

# DEBUG的用法

在 DOSBox 中使用 DEBUG 工具时，可以使用以下命令及其用法，这些命令主要用于调试汇编语言程序、查看和修改寄存器与内存内容、执行代码等。以下是 DEBUG 的所有常用命令及其详细用法：



### 1. **进入和退出 DEBUG**

- **进入 DEBUG**：在 DOSBox 中输入 `debug` 命令。
- **退出 DEBUG**：使用 `q` 命令退出 DEBUG 并返回到 DOSBox 命令行。

### 2. **寄存器操作**

- **查看所有寄存器**：输入 `r`，查看所有寄存器的当前值。
- **查看和修改单个寄存器**：输入 `r <寄存器名>`，例如 `r ax`，查看 AX 寄存器的值。输入新值后按回车即可修改。

### 3. **内存操作**

- **查看内存内容**：
  - `d [起始地址]`：从指定地址开始查看内存内容。
  - `d [起始地址] [结束地址]`：查看指定范围内的内存内容。
- **修改内存内容**：
  - `e [内存地址]`：修改指定地址的内存内容。
  - `e [内存地址] '文本'`：直接输入文本内容。
- **填充内存内容**：
  - `f [起始地址] [结束地址] [值1] [值2]...`：用指定值填充内存区域。

### 4. **汇编指令操作**

- **输入汇编指令**：
  - `a [地址]`：从指定地址开始输入汇编指令。输入完成后按回车退出。
- **反汇编指令**：
  - `u [地址]`：从指定地址开始反汇编指令。
  - `u [段地址:偏移地址]`：指定段地址和偏移地址进行反汇编。

### 5. **程序执行**

- **单步执行**：
  - `t`：执行当前指令并进入下一步。
  - `t [地址]`：从指定地址开始单步执行。
- **连续执行**：
  - `g`：从当前地址开始执行程序。
  - `g=[地址]`：从指定地址开始执行程序，并设置断点。
- **运行程序至结束**：使用 `p` 命令。

### 6. **其他功能**

- **计算偏移量**：
  - `h value1 value2`：计算两个十六进制值的和。
- **保存程序到文件**：
  - `p [文件名] [地址]`：将内存中的程序保存到文件。

# 汇编程序中的注意点

关于下面四个指令，在汇编程序中有不同的含义：

```assembly
mov al,[0]
mov al,ds:[0]
mov al,[bx]
mov al,ds:[bx]
```

(1) （al）= 0

(2) （al）= ((ds)*16 + 0)

(3) （al）= ((ds)*16 + bx)

(4) （al）= ((ds)*16 + bx)

所以总结得到：

+ 如果在"[ ]"里用一个常量idata直接给出内存单元的偏移地址，就要在"[ ]"前面显式的给出段地址所在的寄存器，否则会被解释为常量
+ 如果在"[ ]"里面使用寄存器，则默认段地址为ds，可以不用显式的表现 

# 汇编程序的入口

当我们在代码段设置数据时会遇到一个问题，就是程序的入口被设置在代码段

但是这会导致程序无法执行，因为你定义的字节被反编译后可能是未被定义的或者意义不明的指令

所以我们在运行程序时需要手动调节IP值，那么有什么更好的办法呢？

我们可以在汇编代码时事先定义程序的入口：

```assembly
assume cs:code
code segment
	...
	;数据
	...
start:
	...
	;代码
	...
code ends
end start
```

通过这种格式我们可以在start处定义函数的入口，程序将从此开始运行

 那么换个角度思考，我们既然可以指定程序的入口，那么我们就可以对程序进行分段

我们将数据，代码，栈分别放入不同的段中

比如下面这个程序

```assembly
assume cs:code,ds:data,ss:stack
data segment
	;字型数据
data ends
stack segment
	;定于栈空间
stack ends
code segment
start:;代码
code ends
end start
```

注意要分清什么是伪指令，什么是汇编指令。CPU如何处理我们定义的段空间，完全是靠程序中具体的汇编指令，这里的伪指令只是将其进行了抽象，这样的分段定义，实际上是基于段寄存器的使用。并非我们想象的直接对内存进行分段

# 汇编程序转换大小写

首先我们要知道ASCII字符中大小写字母之间有什么样的联系

+ 大写字母的十六进制数值比小写字母的十六进制数值小 **20H**
+ 大写字母和小写字母的区别在于小写字母的**第五位是1**(因为位数从0开始计算)

## 循环遍历

所以我们可以写出以下程序：

```assembly
assume cs:code,ds:data
data segment
    db 'BaSiC'
    db 'iNfOrMaTiOn'
data ends

code segment
start:mov ax,data
      mov ds,ax
      mov bx,0
      mov cx,5

    s:mov al,[bx]
      and al,11011111B ;小写
      mov [bx],al
      inc bx
      loop s

      mov bx,5
      mov cx,11

   s0:mov al,[bx]
      or al,00100000B ;大写
      mov [bx],al
      inc bx
      loop s0

      mov ax,4c00h
      int 21h
code ends
end start

```

可以看到我们使用了两个循环，分别将其转换为大小写

## 数组处理

我们可以用'[bx+idata]'的形式来模拟数组的行为

```assembly
assume cs:code,ds:data
data segment
    db 'BaSiC'
    db 'MinIX'
data ends
code segment
start:mov ax,data
      mov ds,ax
      mov bx,0

      mov cx,5

s:    mov al,0[bx]
      and al,11011111B
      mov 0[bx],al
      mov al,5[bx]
      or al,00100000B
      mov 5[bx],al
      inc bx
      loop s 
      
      mov ax,4c00h
      int 21h
code ends
end start
    
```

这里面的 `0[bx]`和 `5[bx]`可以分别理解为C语言中的 `a[]`和 `b[]`，只不过这里体现的是偏移地址

在这里我们有几种等价的表达方式：

```
[bx + idata] = idata[bx] = [bx].idata
```

我们可以用数组的思想去理解

# 汇编内存寻址的进一步理解

我们依次进行深入：

## DS，SS，CS

作为一个段地址，往往用来划分一定的内存区域存放特定的数据

我们可以理解成C语言中，申请了一段空间（空间）

## [BX]寄存器间接寻址

通过修改寄存器BX中的值，我们可以进一步索引到段中的某一部分内存的起点

我们可以理解成在这一片空间中划分了一部分作为数组（一维数组）

## [BX + idata]寄存器相对寻址

我们以BX确定在段空间的位置后，我们可以用常量去查询指定内存的数值

此时我们可以把常量idata理解成数组的下标（二维数组）

我们可以用以下形式表达：

```
[bx + idata] = idata[bx] = [bx].idata
```

## [BX + SI/DI + idata]相对基址变址寻址

我们先用BX确定一部分空间，再用SI/DI中的地址确定在这段空间中的位置，然后用常量去查询指定内存中的数值

此时我们可以把SI/DI中的数值理解成二维数组的首地址，而常量作为数组下标进行索引（三维数组）

当没有常量时我们这样表达：（基址变址寻址）

``` 
[bx + si/di] = [bx][si/di]
```

有常量时我们这样表达：

```
[bx + si/di + idata] = idata[bx][si/di] = [bx].idata[si/di] = [bx][si/di].idata
```

## SI/DI 

这两个寄存器是8086CPU中与bx功能相近的寄存器，这两个寄存器**不能**被分成两个八位的寄存器来使用

通过这些各种各样的表达方式，我们可以根据自己的需求进行各种各样的寻址

# 新的汇编指令

## div指令

使用这个指令时我们需要注意以下几点：

+ 除数：有8位和16位两种，在一个reg或者内存单元中
+ 被除数：默认放在AX或DX和AX中，被除数的位数是除数的两倍，如果被除数是32位，那么DX存放高十六位，AX存放低十六位
+ 结果：如果除数为8位，则AL存储除数操作的商，AH存储除数操作的余数；如果为16位，那么AX存储商，DX存储余数

## 伪指令 dd

`db`,`dw`,`dd`分别代表三种不同的定义类型

```assembly
db			;定义字节（byte）类型
dw			;定义字（word）类型
dd			;定义double类型
```

## dup

用来重复定义同一类型的数据

```assembly
db 重复的次数 dup （重复的字节类型）
dw 重复的次数 dup （重复的字类型）
dd 重复的次数 dup （重复的双字类型）
```

比如定义200个字类型

```assembly
dw 200 dup (0)
```

# 实验七

答案如下：

```assembly
assume cs:code
data segment
    db '1975','1976','1977','1978','1979','1980','1981','1982','1983'
    db '1984','1985','1986','1987','1988','1989','1990','1991','1992'
    db '1993','1994','1995'
    ;0-84 0-54H

    dd 16,22,382,1356,2390,8000,16000,24486,50065,97479,140417,197514
    dd 345980,590827,803530,1183000,1843000,2759000,3753000,4649000,5937000
    ;85-168 55H-A9H
    
    dw 3,7,9,13,28,38,130,220,476,778,1001,1442,2258,2793,4037,5635,8226
    dw 11542,14430,15257,17800
    ;169-210 AAH-D4H

data ends
table segment
    db 21 dup ('year summ ne ?? ')
table ends
code segment
start:  mov ax,data
        mov ds,ax
        mov ax,table
        mov es,ax

        mov bp,0
        mov si,0
        mov di,0
        mov cx,21

s:      mov ax,ds:[si]
        mov es:[di],ax
        mov ax,ds:[si+2]
        mov es:[di+2],ax

        mov ax,ds:[84+si]
        mov es:[di+5],ax
        mov ax,ds:[84+si+2]
        mov es:[di+5+2],ax
        
        mov ax,ds:[168+bp]
        mov es:[di+10],ax

        mov ax,ds:[84+si]
        mov dx,ds:[84+si+2]
        div word ptr ds:[168+bp]
        mov es:[di+13],ax

        add si,4
        add di,16
        add bp,2

        loop s

        mov ax,4c00h
        int 21h

code ends
end start


       
```

