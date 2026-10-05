---
title: 8086CPU_Learning(11)
date: 2025-01-30 22:31:35
series: "8086 CPU 学习"
weight: 11
---
这几天一直在玩，要抓紧学完，去学别的东西哦



# 直接定址表

学习如何有效的组织数据，以及相关的编程技术

## 描述了单元长度的标号

我们先以一个程序为例

```assembly
assume cs:code 
code segment
    a: db 1,2,3,4,5,6,7,8
    b: dw 0
start:
    mov si,offset a
    mov bx,offset b
s:
    mov al,cs:[si]
    mov ah,0
    add cs:[bx],ax
    inc si
    loop s
    mov ax,4c00H
    int 21h
code ends
end start  
```

这里的 `a` `b` `start` `s` `code`都是标号。这些标号仅仅表示了内存单元的地址

但是我们还有一种标号，这种标号不仅表示内存单元的地址，同时还表示了内存单元的长度

上面的程序可以写成下面的形式

```assembly
assume cs:code 
code segment
    a db 1,2,3,4,5,6,7,8
    b dw 0
start:
    mov si,offset a
    mov bx,offset b
s:
    mov al,cs:[si]
    mov ah,0
    add cs:[bx],ax
    inc si
    loop s
    mov ax,4c00H
    int 21h
code ends
end start  
```

在code段中使用的标号a，b后面没有 `:`，他们是同时描述内存地址和长度的标号，例如：

+ 标号a，描述了地址code:0，和从这个地址开始，以后的内存单元都是字节单元
+ 标号b，描述了地址code:8，和从这个地址开始，以后的内存单元都是字单元

可见，使用这种包含单元长度的标号，可以使我们以简洁的形式访问内存中的数据。我们将这种标号称为 **数据标号**

## 在其他段中使用数据标号

### 指定段寄存器

在其他段中，也可以使用数据标号来描述存储数据的单元的地址和长度

不过要注意，在后面加有":"的地址标号，只能在代码段中使用，不能在其他段中使用

比如我们以一个累加程序为例：

```assembly
assume cs:code,ds:data
data segment
    a db 1,2,3,4,5,6,7,8
    b dw 0
data ends
code segment
start:
    mov ax,data
    mov ds,ax
    mov si,0
    mov bx,8
s:
    mov al,a[si]
    mov ah,0
    add b,ax
    inc si
    loop s
    mov ax,4c00H
    int 21h
code ends
end start  
```

注意，如果想在代码段中直接用数据标号访问数据，需要用都安寄存器和标号所在的段进行关联，否则编译器无法却确定标号的段地址在哪一个寄存器里。

> 这里并不是说，如果用assume指令将段寄存器和某个段相联系，段寄存器中就真的回存放该段的地址。我们在程序中，仍然需要指令对段寄存器进行设置

### 将标号当作数据定义

可以将标号当作数据来定义，此时，编译器将标号所表示的地址当作数据的值。比如：

```assembly
data segment
	a db 1,2,3,4,5,6,7,8
	b dw 0
	c dw a,b
data ends
```

数据标号c存储的两个字型数据为标号a,b的偏移地址。相当于：

`c dw offset a, offset b`

再比如：

```assembly
data segment
	a db 1,2,3,4,5,6,7,8
	b dw 0
	c dd a,b
data ends
```

数据标号c处存储的两个双字型为标号a的偏移地址和段地址，标号b的偏移地址和段地址。相当于：

`c dw offset a,seg a,offset b,seg b`

> 这里的seg操作符,功能为取得某一标号的段地址

## 直接定址表

我们注意到数值0~15和字符"0"~"F"之间并没有直接的映射关系，所以我们需要再他们之间建立新的映射关系

>数值0~9和字符"0"~"9"之间的映射关系最明显，有 `数值 + 30H = 对应字符的ASCII值`
>
>数值10~15和字符"A"~"F"之间的映射关系则是，`数值 + 37H = 对应字符的ASCII值`

具体的做法是，建立一张表，表中依次存储字符"0"~"F"，我们可以通过数值0~15直接查找到对应的字符

```assembly
assume cs:code
stack segment
    dw 16 dup(0)
stack ends
code segment
start:
    mov ax,stack
    mov ss,ax
    mov sp,16
    mov ax,3AH
    call show

    mov ax,4c00H
    int 21h

showbyte:
    jmp short show
    table db '0123456789ABCDEF' ;字符表

show:
    push bx
    push es

    mov ah,al
    shr ah,1
    shr ah,1
    shr ah,1
    shr ah,1            ;取高四位
    and al,00001111b    ;取低四位

    mov bl,ah
    mov bh,0
    mov ah,table[bx]

    mov bx,0b800H
    mov es,bx
    mov es:[160*12+40*2],ah

    mov bl,al
    mov bh,0
    mov al,table[bx]

    mov es:[160*12+40*2+2],al

    pop es
    pop bx

    ret

code ends
end start  
```

这张表定义后可以实现映射操作，当我们向ax中传输一个数值时，它会返回这个数值到显示器上

这种映射关系一般用作以下几种用途：

+ 为了算法的清晰和简洁
+ 为了加快运算速度
+ 为了使程序易于填充

接下来编写一个子程序$$\sin(x), \quad x \in \{0^\circ, 30^\circ, 60^\circ, 90^\circ, 120^\circ, 150^\circ, 180^\circ\}$$并在屏幕中央显示结果，我们可以用麦克劳林公式进行计算sin(x)，不过为了加快运算速度，在这里我们使用映射来加快这个过程。我们可以写出以下程序：

```assembly
assume cs:code
stack segment
    dw 16 dup(0)
stack ends
code segment
start:
    mov ax,stack
    mov ss,ax
    mov sp,16
    mov ax,120
    call show

    mov ax,4c00H
    int 21h

showsin:
    jmp short show
    table dw ag0,ag30,ag60,ag90,ag120,ag150,ag180   ;字符串偏移地址
    ag0 db '0',0
    ag30 db '0.5',0
    ag60 db '0.866',0
    ag90 db '1',0
    ag120 db '0.866',0
    ag150 db '0.5',0
    ag180 db '0',0
show:
    push bx
    push es
    push si
    mov bx,0b800H
    mov es,bx
    ;用角度/30作为相对于table的偏移值，取得对应的字符串的偏移地址，放在bx中
    mov ah,0
    mov bl,30
    div bl
    mov bl,al
    mov bh,0
    add bx,bx       ;注意每个标号实际上使双字节的
    mov bx,table[bx]
    ;显示
    mov si,160*12+40*2
shows:
    mov ah,cs:[bx]  ;此时bx存储了表中的偏移地址
    cmp ah,0
    je showret
    mov es:[si],ah
    inc bx
    add si,2
    jmp short shows
showret:
    pop si
    pop es
    pop bx
    ret


code ends
end start  
```

上面这种可以通过依据数据，直接计算出所要找的元素的位置的表，我们称之为直接定址表

## 程序入口的直接定址表

我们可以在直接定址表中存储子程序的地址，从而方便的实现不同子程序的调用。

我们编写以下程序

![image.png](https://s2.loli.net/2025/01/31/YNWk86wOunj3VKX.png)

得知需求之后，分析一下功能的实现：

1. 清屏：讲显存中当前屏幕中的字符设置为空格符
2. 设置前景色：设置显存中当前屏幕中处于奇地址的属性字节的第0，1，2位
3. 设置背景色：设置显存中当前屏幕中处于奇地址的属性字节的第4，5，6位
4. 向上滚动一行：依次将第n+1行的内容复制到第n行；最后一行为空

我们可以写出以下程序：

```assembly
assume cs:code
stack segment
    dw 32 dup(0)
stack ends
code segment
start:
    mov ax,stack
    mov ss,ax
    mov sp,32

    mov ah,3
    mov al,1
    call setscreen

    mov ax,4c00h
    int 21h
setscreen:
    jmp short set
table  dw sub1,sub2,sub3,sub4
set:
    push bx
    cmp ah,3
    ja sret
    mov bl,ah
    mov bh,0
    add bx,bx

    call word ptr table[bx]

sret:
    pop bx
    ret

;清屏
sub1:
    push bx
    push cx
    push es
    mov bx,0b800h
    mov es,bx
    mov bx,0
    mov cx,2000
sub1s:
    mov byte ptr es:[bx],' '
    add bx,2
    loop sub1s
    pop es
    pop cx
    pop bx
    ret
;设置前景色
sub2:
    push bx
    push cx
    push es
    mov bx,0b800h
    mov es,bx
    mov bx,1
    mov cx,2000
sub2s:
    and byte ptr es:[bx],11111000b
    or es:[bx],al
    add bx,2
    loop sub2s
    pop es
    pop cx
    pop bx
    ret
;设置背景色
sub3:
    push bx
    push cx
    push es
    mov cl,4
    shl al,cl
    mov bx,0b800h
    mov es,bx
    mov bx,1
    mov cx,2000
sub3s:
    and byte ptr es:[bx],10001111b
    or es:[bx],al
    add bx,2
    loop sub3s
    pop es
    pop cx
    pop bx
    ret
;上移一行
sub4:
    push cx
    push si
    push di
    push es
    push ds
    mov si,0b800h
    mov es,si
    mov ds,si
    mov si,160  ;ds:si指向第n+1行
    mov di,0    ;es:di指向第n行
    cld
    mov cx,24
sub4s:
    push cx
    mov cx,160
    rep movsb
    pop cx
    loop sub4s
    mov cx,80
    mov si,0
sub4s1:
    mov byte ptr [160*24+si],' '
    add si,2
    loop sub4s1
    pop ds
    pop es
    pop di 
    pop si 
    pop cx
    ret
code ends
end start
```

根据上面的程序需求即可修改对应的参数

# 最后的挑战

字符串打印

![image.png](https://s2.loli.net/2025/01/31/PFYEj4rz9T7IZx8.png)

程序如下，利用栈和`int 16h`模拟了键盘的输入和撤回：

```assembly
assume cs:code
stack segment
    dw 128 dup(0)
stack ends
code segment
start:
    mov ax,stack
    mov ss,ax
    mov sp,256
    call clean
    mov dh,12
    mov dl,25
    call getstr

    mov ax,4c00h
    int 21h

charstack:
    jmp short charstart
table dw charpush,charpop,charshow
top dw 0            ;栈顶
charstart:
    push bx
    push dx
    push di
    push es

    cmp ah,2
    ja sret
    mov bl,ah
    mov bh,0
    add bx,bx       ;表项是二字节的，所以偏移位置要左移一位
    jmp word ptr table[bx]
charpush:
    mov bx,top
    mov [si][bx],al
    inc top
    jmp sret
charpop:
    cmp top,0
    je sret
    dec top
    mov bx,top
    mov al,[si][bx]
    jmp sret
charshow:
    mov bx,0b800h
    mov es,bx
    mov al,160
    mov ah,0
    mul dh          ;行号
    mov di,ax
    add dl,dl
    mov dh,0        ;列号
    add di,dx
    mov bx,0
charshows:
    cmp bx,top
    jne noempty
    mov byte ptr es:[di],' '
    jmp sret
noempty:
    mov al,[si][bx]
    mov es:[di],al
    mov byte ptr es:[di+2],' '
    inc bx
    add di,2
    jmp charshows
sret:
    pop es
    pop di
    pop dx
    pop bx
    ret
; bye:
;     mov ax,4c00h
;     int 21h
getstr:
    push ax
getstrs:
    mov ah,0
    int 16h
    ; cmp al,1
    ; je bye
    cmp al,20h  
    jb nochar   ;字符码小于20h,说明不是字符
    mov ah,0
    call charstack ;字符入栈
    mov ah,2
    call charstack ;显示字符
    jmp getstrs
nochar:
    cmp ah,0eh     ;BS的扫描码
    je backspace 
    cmp ah,1ch      ;Enter的扫描码
    je enter
    jmp getstrs
backspace:
    mov ah,1
    call charstack  ;字符出栈
    mov ah,2
    call charstack  ;显示字符
    jmp getstrs
enter:
    mov al,0
    mov ah,0
    call charstack  ;0入栈
    mov ah,2
    call charstack  ;显示字符
    pop ax
    ret
;清屏
clean:
    push bx
    push cx
    push es
    mov bx,0b800h
    mov es,bx
    mov bx,0
    mov cx,2000
cleans:
    mov byte ptr es:[bx],' '
    add bx,2
    loop cleans
    pop es
    pop cx
    pop bx
    ret
code ends
end start
```

