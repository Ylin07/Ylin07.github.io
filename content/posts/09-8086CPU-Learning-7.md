---
title: 8086CPU_Learning(7)
date: 2025-01-23 12:55:34
series: "8086 CPU 学习"
weight: 7
---
今天继续学习汇编语言，感觉有点难哇



# 标志寄存器

我们前面介绍了13种寄存器分别的作用，现在还剩一种特殊的寄存器，它有以下功能：

+ 用来存储相关指令的某些执行结果
+ 用来为CPU执行相关指令提供行为依据
+ 用来控制CPU的相关工作方式

这种特殊的寄存器被称为 **标志寄存器（flag）**

它和别的寄存器不同，其他寄存器用来存放数据，具有整个的意义，而flag寄存器是按位起作用的，其每一位都有特定作用

```text
  15   14   13   12   11   10   9    8    7    6    5    4    3    2    1    0
+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+
|	 |	  |    |    | OF | DF | IF | TF | SF | ZF |    | AF |    | PF |    | CF |
+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+
```

我们主要学习 `CF` `PF` `ZF` `SF` `OF` `DF` 这几种标志位

## 常见标志位

### ZF标志位

flag的第六位是ZF，零标志位

它记录相关指令执行后数值是否为0，如果是，那么ZF = 1表示肯定；如果不是，那么ZF = 0表示否定

在8086的指令集中，并不是所有的指令都会影响标志位寄存器

以下的指令是由影响的

```
add sub mul div inc or and
```

以下的没有影响

```\
mov push pop
```

### PF标志

flag的第二位是PF，奇偶标志位

它记录相关指令执行后，其结果的所有bit位中1的个数是否为偶数。如果是偶数，PF = 1；如果不是，PF = 0

比如下面的指令执行后，结果为00001011B,其中有3个1，则PF = 0

```assembly
mov al,1
add al,10
```

### SF标志位

flag的第七位是SF，符号标志位

它记录相关指令执行后，其结果是否为负。如果是，那么SF = 1;如果不是，SF = 0

这里我们知道，我们进行的计算，既可以看作有符号计算，也可以看作无符号计算；当我们进行无符号计算时，无论如何它对于我们而言都是非负数，但是对于SF而言，它的结果始终是由符号的。

也就是说当我们执行相关命令的时候我们始终是会影响到SF标志位的，至于是否需要这种影响，取决于我们自己

### CF标志位

flag的第零位是CF，进位标志位

在进行无符号运算时，它记录了运算结果的最高有效值向更高维的进位值，或从更高位的借位值

当两个数相加时可能向更高位进位CF = 1

```assembly
mov al,98H
add al,al
```

当两个数相减时也有可能向更高位借位

```assembly
mov al,97H
sub al,98H	;借位变成197H-98H = FFH
```

### OF标志位

flag的第十一位是OF，溢出标志位

OF用来记载是否发生了溢出，如果发生，OF = 1；如果没有，OF = 0

这里我们需要区分一下进位与溢出：

+ 进位是针对无符号计算，溢出是针对有符号的计算
+ CF用于检测无符号运算溢出
+ OF用于检测有符号运算溢出

## 更多的指令

### adc指令

adc是带进位的加法指令，它利用CF位上的记录的进位制

```assembly
adc 操作对象1，操作对象2
```

功能：操作对象1 = 操作对象1 + 操作对象2 + CF

我们为什么要加上CF的值呢?我们可以使用其完成低位存在进位的加法，可以分成两步：

+ 低位相加 `add al,bl`
+ 高位进位相加 `adc ah,bh`

比如计算`1E F000 1000H` + `20 1000 1EF0H`的值，结果放在ax(最高位)，bx(次高位)，cx(最低位)

```assembly
mov ax,001EH
mov bx,F000H
mov cx,1000H
add cx,1EF0H
adc bx,1000H
adc ax,0020H
```

### sbb指令

sbb是带借位的减法指令，它利用了CF位上记录的CF值

```assembly
sbb 操作对象1，操作对象2
```

功能：操作对象1 = 操作对象1 - 操作对象2 - CF

比如计算 `003E 1000H`- `0020 2000H`的值，结果放在ax，bx

```assembly
mov bx,1000H
mov ax,003EH
sub bx,2000H
sbb bx,0020H
```

### popf和pushf

pushf的功能时将标志寄存器的值压入栈中

popf则是从栈中弹出数据，送入标志寄存器中

## 比较跳转

### cmp指令

cmp指令的操作相当于sub，只不过其结果不被寄存器储存，而是只影响flag中的标志寄存器

我们可以通过`cmp ax,bx`指令执行后，相关标志位的状态看出比较的结果：

+ 如果(ax) = (bx)，则 zf = 1
+ 如果(ax) != (bx)，则zf = 0
+ 如果(ax) < (bx)，则必将产生借位，cf = 1
+ 如果(ax) >= (bx)，则不必借位，cf = 0
+ 如果(ax) > (bx)，则不必借位，且结果不为0，cf = 0 and zf = 0
+ 如果(ax) <= (bx)，则可能借位，也可能结果为0，cf = 0 or zf = 0

但是在这里我们默认的进行的是无符号计算，但是在实际的比较中我们也会遇到有符号数值的比较

这个时候我们需要结合sf（进位）和of（溢出）的情况进行判断：

+ 当of = 0 时，说明没有溢出，此时 **逻辑上真正结果的正负 = 实际结果的正负**
+ 当of !=0 时，说明溢出，此时 **逻辑上真正结果的正负 ！= 实际结果的正负**

所以我们可以进行有符号整数的判断：

+ 如果 (ax) < (bx)，则(sf = 1 and of = 0) or (sf = 0 and of = 1)
+ 如果 (ax) > (bx)，则sf = 1 and of  = 1
+ 如果 (ax) >= (bx)，则sf = 0 and of = 0

### 检测比较结果的条件转移指令

我们之前使用过jcxz条件跳转指令，但是它是对(cx)进行判断

下面有常用的根据无符号数的比较结果进行转移的条件转移指令：

```text 
指令			 含义						检测的相关标志位
je			等于则转移(=)				 zf = 1
jne			不等于则转移(!=)				zf = 0
jb			低于则转移(<)				 cf = 1
jnb			不低于则转移(>=)				cf = 0
ja			高于则转移(>)				 cf = 0 且 zf = 0
jna			不高于则转移(<=)				cf = 1 或 zf = 0
```

通过cmp指令和比较指令还有标志位，可以实现想要的逻辑判断

## DF标志位和串传送指令

### DF标志位

flag的第十位是DF，方向标志位。在串处理命令中，控制每次操作后si，di的递减

+ df = 0 每次操作后si,di递减
+ df = 1 每次操作后si,di递增

在8086CPU中提供两种方式对df进行修改：

+ `cld`--> 令df = 0
+ `std`--> 令df = 1

### 串传送指令

1. 

```assembly
movsb
```

执行movsb指令相当于进行下面的步骤(将ds:si指向的内存单元中的字节送入es:di中，然后根据df中的值，进行增减)

```assembly
mov es:[di],byte ptr ds:[si]
;如果df=0
inc si
inc di
;如果df=1
dec si
dec di
```

2. 

```assembly
movsw
```

执行movsw指令相当于进行下面的步骤(将ds:si指向的内存字单元中的字送入es:di中，然后根据df中的值，进行增减)

```assembly
mov es:[di],word ptr ds:[si]
;如果df=0
inc si
inc di
;如果df=1
dec si
dec di
```

3. 

```assembly
rep movsb/movesw
```

rep指令的含义是根据cx的值，重复执行后面的指令。可以理解为下面的指令：

```assembly
s:	movsb/movsw
	loop s	
```



当我们使用串传送时，需要为串传送指令提供以下信息：

+ 传送的原始位置
+ 传送的目的位置
+ 传送的长度
+ 传送的方向

## DEBUG中的标志寄存器

![image.png](https://s2.loli.net/2025/01/23/U3mYkrXPlZqKLnH.png)

图中标识了不同标志寄存器对应的位置

下面我们列出Debug对标志位的表示：

```text 
标志				值为1的标记				值为0的标记
of					OV						NV
sf					NG						PL
zf					ZR						NZ
pf					PE						PO
cf					CY						NC
df					DN						UP
```



# 实验11

![image.png](https://s2.loli.net/2025/01/23/k7Or9flVTD3J6Ic.png)

```assembly
assume cs:code,ds:data
data segment
   db "Some day,I'll be enough so you can't hit me.",0
data ends
code segment
begin:
    mov si,0
    call letterc
    mov ax,4c00H
    int 21H

letterc:
    mov ah,ds:[si]
    cmp ah,30H
    je return 
    cmp ah,41H
    jnb s1
    inc si
    jmp letterc

s1:
    cmp ah,7AH
    jna s2
    inc si 
    jmp letterc

s2: 
    and ah,11011111B
    mov ds:[si],ah
    inc si
    jmp letterc

return:
    ret

code ends
end begin 
```

