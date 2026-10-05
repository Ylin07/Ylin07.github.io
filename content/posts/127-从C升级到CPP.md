---
title: 从C升级到CPP
date: 2026-05-27 10:19:10
---

我平时日常是使用C和Python进行开发，但是随着用的时间越来越长。我感觉这两个语言的局限性还是比较明显的，无法满足我的日常开发需求。现在的话我需要一门日常的开发语言。C的话过于底层，我平时用来学习做实验比较多，但是开发一些大型的项目比较麻烦。Python的话很好用，但是不方便打包，导致很多场景下用起来比较麻烦。Java太重了，各种环境配置和规范写起来很麻烦。Rust和Go的话感觉太新了，我最近研究他们的语法感觉还是很不习惯。

所以最终决定把我的C的用法升级一下，改用CPP。因为C++我感觉实际上是C的超集，而且从C编译切换到C++编译也很方便，之前用过一段时间的C++写一些项目，那个时候理解还不够深刻，基本都是按着教程来。现在看来C++是有很多可取之处的。还有就是C++支持的一些功能对我来说很有用，比如`命名空间`,`类`,`函数重载`...

所以我打算使用部分C++的特性，在原来使用C的基础之上，以后使用C++进行代替开发。这里的话就规范一下日后的用法，顺便学习一下，需要注意哪些内容好了：

### 类

这个是我最喜欢的功能，因为C的函数命名非常丑，而且要实现类的用法非常麻烦。有了类之后，我的代码会好看很多，可以把类当作高级结构体来用。至于一些高级用法的话，这里我暂时只打算使用`构造、析构`、`函数重载`，其他的太复杂了之后等熟悉了再用。

这样我就可以将如下C风格代码：

```c
#include <stdio.h>
#include <math.h>

typedef struct {
    double x;
    double y;
} Vec2D;

Vec2D vec_add(const Vec2D *a, const Vec2D *b) {
    Vec2D result;
    result.x = a->x + b->x;
    result.y = a->y + b->y;
    return result;
}

Vec2D vec_sub(const Vec2D *a, const Vec2D *b) {
    Vec2D result;
    result.x = a->x - b->x;
    result.y = a->y - b->y;
    return result;
}

double vec_dot(const Vec2D *a, const Vec2D *b) {
    return a->x * b->x + a->y * b->y;
}

double vec_length(const Vec2D *v) {
    return sqrt(v->x * v->x + v->y * v->y);
}

void vec_print(const Vec2D *v) {
    printf("(%.1f, %.1f)\n", v->x, v->y);
}

int main(){
    Vec2D a = {3.0, 4.0}; 
    Vec2D b = {1.0, 2.0};
    double len = vec_length(&a);
    printf("Length: %.1f\n", len);
}
```

转换成如下C++风格的类代码：

```cpp
#include <cmath>
#include <cstdio>

class Vec2D {
public:
    double x;
    double y;
    
    Vec2D add(const Vec2D& other) const {
        return {x + other.x, y + other.y};
    }
    
    Vec2D sub(const Vec2D& other) const {
        return {x - other.x, y - other.y};
    }
    
    double dot(const Vec2D& other) const {
        return x * other.x + y * other.y;
    }
    
    double length() const {
        return sqrt(x * x + y * y);
    }
    
    void print() const {
        printf("(%.1f, %.1f)\n", x, y);
    }
};

int main() {
    Vec2D a = {3.0, 4.0};  
    Vec2D b = {1.0, 2.0};
    
    Vec2D c = a.add(b);  
    c.print();
    
    double len = a.length();
    printf("Length: %.1f\n", len);
    
}
```

可以进一步函数重载写成：

```c
#include <cmath>
#include <cstdio>

class Vec2D {
private:
    double x,y;
public:
    Vec2D(double x, double y) : x(x), y(y) {}
    
    Vec2D operator+(const Vec2D& other) const {
        return Vec2D(x + other.x, y + other.y);
    }
    
    Vec2D operator-(const Vec2D& other) const {
        return Vec2D(x - other.x, y - other.y);
    }
    
    Vec2D operator*(double scalar) const {
        return Vec2D(x * scalar, y * scalar);
    }
    
    double operator*(const Vec2D& other) const {  
        return x * other.x + y * other.y;
    }
    
    double length() const {
        return sqrt(x * x + y * y);
    }
    
    void print() const {
        printf("(%.1f, %.1f)\n", x, y);
    }
};

int main() {
    Vec2D a = {3.0, 4.0};  
    Vec2D b = {1.0, 2.0};
    Vec2D c = {3.0, 2.0};

    double d = a*b - a*c;  
    printf("Dot product: %.1f\n", d);
    
    double len = a.length();
    printf("Length: %.1f\n", len);
    
}
```

同时公有的方法和私有的变量也可以更好的隐藏一些结构的细节

### 命名空间

命名空间是优化项目命名的关键，在C没有命名空间时，我们想要区分一个同种类型的函数/变量需要给他加上前缀：

```c
// math.h（数学库）
double sin(double x);
double cos(double x);
double length = 10.0;

// geometry.h（几何库）
double length(double x, double y);  // 重复定义

// main.c
#include "math.h"
#include "geometry.h"

int main() {
    double l = length(3, 4);  
    // error: conflicting types for 'length'
}
```

所以正常做法是这样;

```c
// math.h
double math_sin(double x);
double math_cos(double x);
double math_length = 10.0;

// geometry.h
double geo_length(double x, double y);
```

这种类似的问题也会出现在用户库和一些标准库之间。但是有了`namespace`区分用户空间之后我们就可以很好的解决这个问题。

```cpp
namespace Math {
    double sin(double x);
    double cos(double x);
    double length = 10.0;
}

namespace Geo {
    double length(double x, double y);
}

int main() {
    double len1 = Math::length;   
    double len2 = Geo::length(1.0,2.0);  
}
```

所以在CPP中C常用的标准库通过命名空间`std`封装起来了，头文件的名称也会略有不同：

```cpp
// C
#include <stdio.h>
printf("Hello\n");

// C++
#include <cstdio>
std::printf("Hello\n");

using std::printf;	
printf("Hello\n");
```

`namespace`可以用来封装`变量`、`函数`、`类`、`命名空间`、...

而`using`通过`using 命名空间名称::封装内容`的方法将其提取出来。或者`using namespace 命名空间名称`的方法将当前命名空间中的所有内容提取出来。不过一般不推荐这么做，会污染命名空间。

同时`using`还是高级版本的`typedef`，我们可以用它给数据类型设置别名，包括类名：

```cpp
using u8 = uint_8;
using arrary10 = int[10];
using matrix3x3 = int[3][3];
using vec = std::vector<int>;
...
```

### 类型转换

这一部分我记得C++和C还是很不一样的，C++对这个管理的十分严格。在C中任意数据之间都可以互相进行类型转换，只不过后果需要自负。不过这在一些底层的设计中，这个用法非常的有效，比如一些读写内存的操作。但是C++引入了更严格的类型检查。不过太复杂的我暂时也用不到，百分之八十的情况都可以通过以下方式安全的对数据类型进行转换：

```cpp
// C
int i = (int)3.14;
double* p = (double*)&i;

// C++ 
int i = static_cast<int>(3.14);   
double* p = static_cast<double*>(&i);  
```

总之就是使用这个`static_cast<类型>()`的方法强制转换。

### new / delete

C++中分配内存通常使用的是`new`和`delete` 它比C中的`malloc`和`free`更加只能一点，对于创建一些数据结构的时候，使用`new`会自动调用构造函数，同样的使用`delete`也会自动调用析构函数。但是这个还是有点复杂了，所以我觉得可以尽量不使用`new/delete`得情况下就尽量不使用，只针对C++引入得数据结构进行使用。

这里需要注意`new / delete`和`malloc / free`必须是一一对应的。不能混合使用。

```cpp
// C 
int* p1 = (int*)malloc(sizeof(int));
*p1 = 10;
free(p1);
int* arr1 = (int*)malloc(10 * sizeof(int));
free(arr1);

// C++ 
Vec2D* p2 = new Vec2D(1.0,2.0);
delete p2;
Vec2D* arr2 = new Vec2D[10];
delete[] arr2;
```

### 引用

引用本质上就是一个指针的语法糖，只不过对其做了进一步的限制：

```c
#include <cstdio>

int main() {
    int a = 100;
    int& r = a;   // 引用
    int* p = &a;  // 指针
    
    // 查看内存地址
    printf("a 的地址: %p\n", &a);  // 0x7ffd1234
    printf("r 的地址: %p\n", &r);  // 0x7ffd1234（相同）
    printf("p 的地址: %p\n", &p);  // 0x7ffd1238（不同）
    printf("p 存的地址: %p\n", p);  // 0x7ffd1234（不同）
}
```

引用使得`r`和`a`指向的是同一块内存地址，只不过名称不同。但是对引用的赋值只会覆盖内存内容，而不是改变指向的内存。

指针实际上是一个独立的内存空间，在里面存放着a的地址。

在编译器的眼中，引用实际上是对指针的一种约束后的结果：

```c
// 编译器：
int& r = a;   →   int* const r = &a;  // 常指针，不能改指向

// 使用：
r = 20;       →   *r = 20;            // 自动解引用
```

所以在大部分场景中我们可以使用引用来代替指针，最常见的就是传参操作：

```c
// C 
void swap_ptr(int* a, int* b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}
void scale_ptr(Vec2D* v, double factor) {
    v->x *= factor;
    v->y *= factor;
}

// C++
void swap_ref(int& a, int& b) {
    int temp = a;
    a = b;
    b = temp;
}
void scale_ref(Vec2D& v, double factor) {
    v.x *= factor;
    v.y *= factor;
}
```

同时因为引用不为空，所以我们可以保证传入的参数不为空，就不需要像C一样，每次对传入的指针做多余的保护性验证：

```c
// 指针：可能为空，要检查
void func(int* p) {
    if (p == nullptr) return;  
    *p = 10;
}

// 引用：保证不为空，直接用
void func(int& r) {
    r = 10;  
}
```

在某些场景下我们也可以将引用作为返回值，不过那些都是后话了。

### 规范

目前的想法是尽量不引入过多的C++特性和用法，所以写法主要还是以C为主，这个我暂时想不到什么好的规划，要用一段时间之后才能想好该怎么做。这篇文章就到这里把，主要是明确一下使用的思路，还有一些具体的用法。顺便回顾了一下C++的用法。
