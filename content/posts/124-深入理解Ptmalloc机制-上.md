---
title: 深入理解Ptmalloc2(上)
date: 2026-04-14 15:03:53
---

其实一点也不深入，最近在学堆利用。但是很吃力，看了一天的内存分配的过程，还有`malloc`的实现，还有各种乱七八糟的小知识点后，我打算自己整理一遍`ptmalloc2`的机制。

我们通常使用`malloc`在程序中动态的请求内存，但是实际上`malloc`更像一个内存的分配管理器，它按照一定的规则向操作系统请求空间。本质上，它是对`brk`、`mmap`、`munmap`等系统调用的封装。我们将在下面演示这个过程

# Ptmalloc2

## 数据结构

要了解内存分配的机制，首先要了解`ptmalloc`中的几个关键的内部结构，堆的漏洞利用也和这些结构有着紧密的联系：

### malloc_chunk

这个结构是内存分配过程中的最重要的数据结构，我们在程序中由`malloc`申请的内存就是`chunk`。在`ptmalloc`的源代码中，就是数据结构`malloc_chunk`:

```c
/*
  This struct declaration is misleading (but accurate and necessary).
  It declares a "view" into memory allowing access to necessary
  fields at known offsets from a given base. See explanation below.
*/
struct malloc_chunk {
  INTERNAL_SIZE_T      mchunk_prev_size;  /* Size of previous chunk (if free).  */
  INTERNAL_SIZE_T      mchunk_size;       /* Size in bytes, including overhead. */
  struct malloc_chunk* fd;         /* double links -- used only if free. */
  struct malloc_chunk* bk;
  /* Only used for large blocks: pointer to next larger size.  */
  struct malloc_chunk* fd_nextsize; /* double links -- used only if free. */
  struct malloc_chunk* bk_nextsize;
};
```

要注意这里的`malloc_chunk`并不是分配给用户的全部，而是分配的`chunk`的头部信息，记录了以下内容：

+ `prev_size`：前一个块的大小
+ `size`：当前块的大小，size的最后三位作为标志位：
  + `A(NON_MAIN_ARENA)`：记录当前`chunk`是否为主线程
  + `M(IS_MAPPED)`：记录当前`chunk`是否由mmap分配
  + `P(PREV_INUSE)`：记录前一个`chunk`是否被分配，堆中的第一个chunk的P始终为1
+ `fd/bk`：前向指针(fd)指向下一个块的头部，后向指针(bk)指向前一个块的头部（指向的是物理相邻块）
+ `fd_nextsize/bk_nextsize`：这个指向的是下一个大小的块的头部（指向的是相邻大小）

但是这里我们也要注意一点，除了`size`其他的字段在`chunk`的实际使用中可能是被空间复用的，以下是`chunk`被分配时和被释放时的两个视图：

```c
An allocated chunk looks like this:
    chunk-> +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	        |             Size of previous chunk, if unallocated (P clear)  |
	        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	        |             Size of chunk, in bytes                     |A|M|P|
      mem-> +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	        |             User data starts here...                          .
	        .                                                               .
	        .             (malloc_usable_size() bytes)                      .
	        .                                                               |
nextchunk-> +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	        |             (size of chunk, but used for application data)    |
	        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	        |             Size of next chunk, in bytes                |A|0|1|
	        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
                
                
Free chunks are stored in circular doubly-linked lists, and look like this:
    chunk-> +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	        |             Size of previous chunk, if unallocated (P clear)  |
	        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
    "head": |             Size of chunk, in bytes                     |A|0|P|
      mem-> +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	        |             Forward pointer to next chunk in list             |
	        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	        |             Back pointer to previous chunk in list            |
	        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	        |             Unused space (may be 0 bytes long)                .
	        .                                                               .
	        .                                                               |
nextchunk-> +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
    "foot": |             Size of chunk, in bytes                           |
	        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	        |             Size of next chunk, in bytes                |A|0|0|
	        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

关键在于`free chunk`，这里的`head`是空闲块的入口，`foot`是空闲块的尾巴，其中：

+ head：用于记录当前块的元信息（size）
+ foot：记录的也是当前块的元信息，但他实际上是用来帮助下一个块来追踪当前块的地址的。我们可以通过`nextchunk - prev_size`从而得到当前块的首地址（因为块和块之间是物理相邻的），这在释放合并的过程中十分重要，能帮助我们快速计算出上一个块的地址。

接下来还需要介绍一下chunk常用的宏：

**chunk和mem的头部指针转换**

```c
// 2*SIZE_SZ 是元信息 prev_size 和 size 的大小
#define chunk2mem(p) ((void *) ((char *) (p) + 2 * SIZE_SZ))
#define mem2chunk(mem) ((mchunkptr)((char *) (mem) -2 * SIZE_SZ))
```

**最小申请的堆内存大小**

```c
// MALLOC_ALIGN_MASK 为 15
#define MIN_CHUNK_SIZE (offsetof(struct malloc_chunk, fd_nextsize))
#define MINSIZE  \
  (unsigned long)(((MIN_CHUNK_SIZE+MALLOC_ALIGN_MASK) & ~MALLOC_ALIGN_MASK))
```

这里`(X + align) & ~align`是对齐的用法，可以让x向上对齐到`align+1`的地址

**将用户请求内存大小转为实际分配内存大小**

```c
// 被分配的空间实际上是 size + men(req) 然后向上对齐，prev不算开销
#define request2size(req)                                         \
  (((req) + SIZE_SZ + MALLOC_ALIGN_MASK < MINSIZE)  ?             \
   MINSIZE :                                                      \
   ((req) + SIZE_SZ + MALLOC_ALIGN_MASK) & ~MALLOC_ALIGN_MASK)
```

**获取相邻块**

```c
// 获取块的大小
#define chunksize(p) (chunksize_nomask(p) & ~(SIZE_BITS))
#define chunksize_nomask(p) ((p)->mchunk_size)
// 获取下一个物理相邻块
#define next_chunk(p) ((mchunkptr)(((char *) (p)) + chunksize(p)))
// 获取上一个物理相邻块
#define prev_chunk(p) ((mchunkptr)(((char *) (p)) - prev_size(p)))
```

获取了chunk之后，使用chunk的指针和修改相关的标志位就很自然了，不再过多说明

### bin

用户释放掉的`chunk`并不会直接被归还系统，`ptmalloc`会统一管理`heap`和`mmap`映射区域中的空闲`chunk`。同时将不同大小的`chunk`挂载到不同的bin下面进行管理，从而解决了以下问题：

+ **复用空闲内存**：避免了反复的请求空间，可以实现对同一片空间的反复复用
+ **快速匹配合适的空闲块**：通过合适的管理结构，可以快速的查找到合适大小的空闲块
+ **减少内存碎片**：如果只是复用相同大小的块，就会由较多内存碎片。随意合并则会破会缓存局部性。合理的选择bin的策略，可以优化这些问题。


在 `ptmalloc` 中有以下四种 `bin`，它们根据 `chunk` 的大小和特性来进行分类：

| 类型 | 大小范围 | 数据结构 | 存取策略 | 是否合并 | 特点 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Fast Bin** | ≤ 160 字节 (64位) | 单向链表 | LIFO（后进先出） | 不合并 | 速度优先，小块内存的快速通道 |
| **Unsorted Bin** | 任意大小 | 双向循环链表 | FIFO（先进先出） | 会合并 | 空闲块的中转站，延迟整理 |
| **Small Bin** | < 512 字节 | 双向循环链表 | FIFO（先进先出） | 会合并 | 固定大小，精确匹配，共 62 个 |
| **Large Bin** | ≥ 512 字节 | 双向循环链表 + 大小链 | FIFO + 大小排序 | 会合并 | 范围匹配，最佳适配，共 63 个 |

了解了bin的分类和作用后，我们结合源码来进一步理解`bin`是怎么实现的。在 `ptmalloc` 中，Bin 不是一个独立的数据结构，而是嵌入在 Arena（`malloc_state`）中的一组数组。每个 Bin 本质上是一个链表头，指向一串相同（或相近）大小的空闲 `chunk`：

```c
#define NBINS             128	
...
mchunkptr bins[NBINS * 2 - 2];	// 主要用于索引不同 bin 的 fd 和 bk
...
```

`bins`数组实际上就是每两个元素存放一个bin的`fd`和`bk`。数组中的 bin 依次如下：

+ **unsorted bin**：`bin_at(m,1)`
+ **small bin**：`bin_at(m,2)`-`bin_at(m,63)`
+ **large bin**：`bin_at(m,64)`-`bin_at(m,127)`
+ **fast bin**：存储在`fastbinsY`中，索引数和机器字长有关

```c
// 索引malloc_state中的bin
#define bin_at(m, i) \
  (mbinptr) (((char *) &((m)->bins[((i) - 1) * 2]))			      \
             - offsetof (struct malloc_chunk, fd))
// 获取下一个bin的地址
#define next_bin(b)  ((mbinptr) ((char *) (b) + (sizeof (mchunkptr) << 1)))
// 获取当前bin的链表头的chunk
#define first(b)     ((b)->fd)
// 获取当前bin的链表尾的chunk
#define last(b)      ((b)->bk)
```

#### Fastbin

程序在运行时经常会申请和释放大量的小块内存（例如几十字节的临时缓冲区）。如果每次释放时都进行合并检查，每次分配时都去遍历合适的 bin，效率会非常低——因为小块内存的生命周期通常很短，刚释放的块很可能马上又被重新申请。

为了优化这个这个场景，我们引入`fastbin`，当符合`fastbin`大小要求的`chunk`释放的时候，我们不进行合并操作，也不立即归还系统，而是直接将其挂入 fastbin 链表中，然后根据`LIFO`的规则对`chunk`进行存取。这样我们可以总结出`fastbin`的几个特点：

+ **不做合并**：释放时挂入链表，不用检查相邻块
+ **LIFO策略**：后进先出，释放时插入头部，分配时从头部取出
+ **单向链表**：只维护`fd`指针

Fastbin 存储在 `malloc_state` 的独立数组 `fastbinsY` 中：

```c
#define NFASTBINS  (fastbin_index (request2size (MAX_FAST_SIZE)) + 1)
...
mfastbinptr fastbinsY[NFASTBINS];
...
```

fastbin管理分配的块的可视化效果就像下面这样：

```c
fastbinsY[0] -> NULL                                        
fastbinsY[1] -> 0x603020 -> NULL                          
fastbinsY[2] -> 0x603040 -> 0x603010 -> NULL             
fastbinsY[3] -> NULL                                       
...                                                          
fastbinsY[9] -> 0x6030a0 -> 0x603080 -> NULL
```

且索引和fastbin管理的块大小是有关系的：

```c
chunksize:  32 -> 48 -> 64 -> ... -> 176 (64bit)
            16 -> 24 -> 32 -> ... -> 88  (32bit)
idx: 		0 ->  1 ->  2 -> ... ->  9
```

具体如下：

```c
// 用来访问fastbin
#define fastbin(ar_ptr, idx) ((ar_ptr)->fastbinsY[idx])
/* offset 2 to use otherwise unindexable first 2 bins */
// 用来根据size计算在fastbin下的索引
#define fastbin_index(sz) \
  ((((unsigned int) (sz)) >> (SIZE_SZ == 8 ? 4 : 3)) - 2)
```

基于这个原理，我们可以通过申请在某个大小范围内的空间，来反复取出同一个`bin`下的`chunk`。

#### Small bin

Fastbin 解决了小块内存的快速复用问题，但它有一个局限：每个 Fastbin 只管理固定大小的块，且大小范围有限（≤160 字节）。对于稍大一些的中小块内存（例如 192 字节、256 字节、512 字节），如果仍然使用 Fastbin 的策略，会遇到两个问题：

+  **范围不够**：Fastbin 最大只到 160 字节，更大的块无法享受快速通道
+ **碎片累积**：Fastbin 不合并，如果中小块也采用同样策略，碎片问题会更严重

因此，ptmalloc 引入了 Small Bin，专门管理中等大小的内存块。与 Fastbin 追求极致速度不同，Small Bin 在速度和空间利用率之间做了平衡：

- **双向链表**：维护 `fd` 和 `bk` 指针，支持双向遍历。（因为需要支持从链表中间删除节点`unlink`）
- **FIFO 策略**：先进先出，释放时插入头部，分配时从尾部取出
- **会合并**：释放时会检查相邻块，合并空闲块减少碎片。但 Small Bin 本身不直接接收释放的块，释放的块先进入 Unsorted Bin，后续整理时才进入 Small Bin。
- **大小固定**：每个 Small Bin 只管理一种固定大小的块

Small Bin 不单独存储，而是放在 `malloc_state` 的 `bins` 数组中，与 Unsorted Bin 和 Large Bin 共用空间，Small Bin 占据 `bin_at(m, 2)` 到 `bin_at(m, 63)`，其大小分布和索引有直接关系：

```c
// 判断是否属于smallbin范围
#define in_smallbin_range(sz)  \
  ((unsigned long) (sz) < (unsigned long) MIN_LARGE_SIZE)
// size >> 4 = size / 16 = 索引
#define smallbin_index(sz) \
  ((SMALLBIN_WIDTH == 16 ? (((unsigned) (sz)) >> 4) : (((unsigned) (sz)) >> 3))\
   + SMALLBIN_CORRECTION)
```

所以smallbin大小如下:

```c
chunksize:  32 -> 48 -> 64 -> ... -> 1008 (64bit)
            16 -> 24 -> 32 -> ... -> 504  (32bit)
idx: 		2 ->  3 ->  4 -> ... ->  63
```

smallbin的可视化效果就如下：

```c
bin_at(m, 2)  -> 0x603100 -> 0x6030e0 -> 0x6030c0 -> NULL  (32字节)
bin_at(m, 3)  -> 0x603120 -> 0x6030f0 -> NULL              (48字节)
bin_at(m, 4)  -> 0x603140 -> NULL                          (64字节)
bin_at(m, 5)  -> 0x603160 -> 0x603130 -> 0x603110 -> NULL  (80字节)
...
bin_at(m, 62) -> 0x603200 -> 0x6031e0 -> NULL              (992字节)
bin_at(m, 63) -> NULL                                      (1008字节)
```

这里可以发现fastbin和smallbin的`chunk`大小范围是会有很大一部分重合的，这并非设计缺陷，而是缓存分层的体现——Fastbin 作为 L1 缓存优先响应，Small Bin 作为 L2 缓存作为后备。具体细节将在后续源码分析中展开。

#### Large bin

Fastbin 和 Small Bin 解决了小块和中块内存的快速分配问题，但它们都有一个共同特点：每个 bin 只管理一种固定大小的块。这种设计对于小块内存非常高效——因为步长小（16 或 8 字节），bin 的数量足够覆盖。

但当请求的内存越来越大时，固定步长的策略会遇到问题：

+ **bin的数量不够**：如果从 32 字节到 1MB 都用 16 字节步长，需要约 65536 个 bin
+ **内存浪费严重**：大多数的bin会长期为空，占用内存
+ **遍历效率低**：过多的bin，不方遍管理和遍历

为此，ptmalloc 引入了 Large Bin，采用对数分布的范围匹配策略，在管理范围和 bin 数量之间取得平衡：

- **双向链表 + 大小有序链表**：主链表（`fd`/`bk`）用于 FIFO 分配策略；大小链表（`fd_nextsize`/`bk_nextsize`）用于快速跳过相同大小的块，直接定位到“最小足够大”的块

  ```c
  struct malloc_chunk {
    // ...
    struct malloc_chunk* fd;         // 主链表：指向下一个块
    struct malloc_chunk* bk;         // 主链表：指向前一个块
    struct malloc_chunk* fd_nextsize; // 大小链表：指向下一个不同大小的块
    struct malloc_chunk* bk_nextsize; // 大小链表：指向上一个不同大小的块
  };
  ```

- **FIFO 策略**：先进先出，释放时插入头部，分配时从尾部取出

- **会合并**：释放时会检查相邻块，合并空闲块减少碎片。Large Bin 中的块来自 Unsorted Bin 的整理，或从 Top Chunk 切割后的剩余部分。

- **范围匹配**：每个Bin覆盖一个大小区间

关于largebin的索引和大小的计算比较复杂，可以看到相关的宏定义如下：

```c
#define MIN_LARGE_SIZE    ((NSMALLBINS - SMALLBIN_CORRECTION) * SMALLBIN_WIDTH)
#define largebin_index_32(sz)                                                \
  (((((unsigned long) (sz)) >> 6) <= 38) ?  56 + (((unsigned long) (sz)) >> 6) :\
   ((((unsigned long) (sz)) >> 9) <= 20) ?  91 + (((unsigned long) (sz)) >> 9) :\
   ((((unsigned long) (sz)) >> 12) <= 10) ? 110 + (((unsigned long) (sz)) >> 12) :\
   ((((unsigned long) (sz)) >> 15) <= 4) ? 119 + (((unsigned long) (sz)) >> 15) :\
   ((((unsigned long) (sz)) >> 18) <= 2) ? 124 + (((unsigned long) (sz)) >> 18) :\
   126)
// XXX It remains to be seen whether it is good to keep the widths of
// XXX the buckets the same or whether it should be scaled by a factor
// XXX of two as well.
#define largebin_index_64(sz)                                                \
  (((((unsigned long) (sz)) >> 6) <= 48) ?  48 + (((unsigned long) (sz)) >> 6) :\
   ((((unsigned long) (sz)) >> 9) <= 20) ?  91 + (((unsigned long) (sz)) >> 9) :\
   ((((unsigned long) (sz)) >> 12) <= 10) ? 110 + (((unsigned long) (sz)) >> 12) :\
   ((((unsigned long) (sz)) >> 15) <= 4) ? 119 + (((unsigned long) (sz)) >> 15) :\
   ((((unsigned long) (sz)) >> 18) <= 2) ? 124 + (((unsigned long) (sz)) >> 18) :\
   126)
#define largebin_index(sz) \
  (SIZE_SZ == 8 ? largebin_index_64 (sz)                                     \
   : MALLOC_ALIGNMENT == 16 ? largebin_index_32_big (sz)                     \
   : largebin_index_32 (sz))
```

大概就是largebin中一共有63个bin，这些bin被分成6组，同一组内的`chunk`大小公差是一致的，就像下面这样：

|    组    | 1    | 2    | 3     | 4      | 5        | 6      |
| :------: | ---- | ---- | ----- | ------ | -------- | ------ |
| **数量** | 32   | 16   | 8     | 4      | 2        | 1      |
| **公差** | 64B  | 512B | 4096B | 32768B | 2622144B | 不限制 |

Large Bin 可以看作是 Small Bin 在大块内存区域的扩展，但由于大小范围太宽，无法采用固定步长，因此改用范围匹配策略，并引入大小链表加速查找。

#### Unsorted bin

Fastbin、Small Bin 和 Large Bin 构成了 ptmalloc 的空闲块管理体系，但它们都有一个共同特点——释放的块需要被“整理”到对应的 bin 中。这个整理过程是有成本的：需要计算大小、找到对应的 bin、插入链表。如果每次释放都立即整理，对于频繁分配释放的场景来说，开销不可忽视。

更重要的是，刚释放的块很可能马上又被重新申请。如果能够优先复用这些“新鲜”的空闲块，可以大大提高缓存命中率。为此，ptmalloc 引入了 Unsorted Bin，作为空闲块的“中转站”或“一级缓存”。

unsorted bin 处于我们之前所说的 bin 数组下标 1 处：

```c
#define unsorted_chunks(M) (bin_at(M, 1))
```

而 unsorted bin 只有一个链表。unsorted bin 中的空闲 `chunk` 处于乱序状态，主要有两个来源：

- 当一个较大的 `chunk` 被分割成两半后，如果剩下的部分大于 MINSIZE，就会被放到 unsorted bin 中
- 释放一个不属于 fast bin 的 chunk，并且该 `chunk` 不和 `top chunk` 紧邻时，该 `chunk` 会被首先放到 unsorted bin 中

### Top chunk

程序第一次进行 malloc 的时候，heap 会被分为两块，一块给用户，剩下的那块就是 top chunk。其实，所谓的 top `chunk` 就是处于当前堆的物理地址最高的 chunk。这个 `chunk` 不属于任何一个 bin，它的作用在于当所有的 bin 都无法满足用户请求的大小时，如果其大小不小于指定的大小，就进行分配，并将剩下的部分作为新的 top chunk。否则，就对 heap 进行扩展后再进行分配。在 main arena 中通过 sbrk 扩展 heap，而在 thread arena 中通过 mmap 分配新的 heap。

在代码中通过以下方式初始化`topchunk`:

```c
#define initial_top(M)              (unsorted_chunks (M))
```

这个设计很巧妙，通过将`unsorted chunk`作为`topchunk`，此时。当malloc第一次使用时，发现`topchunk->size=0`，只会认为是其空间不够了，从而通过`sysmalloc`申请空间。这样的话就简化了初始化的过程，逻辑会更加统一。

### malloc_state

其数据结构在源码中如下：

```c
struct malloc_state {
  __libc_lock_define (, mutex);     // 互斥锁
  int flags;                        // 标志位
  int have_fastchunks;              // 是否有 fastbin 块
  mfastbinptr fastbinsY[NFASTBINS]; // Fast bins
  mchunkptr top;                    // Top chunk
  mchunkptr last_remainder;         // 上次切割剩余块
  mchunkptr bins[NBINS * 2 - 2];    // Unsorted/Small/Large bins
  unsigned int binmap[BINMAPSIZE];  // bin 位图
  struct malloc_state *next;        // 下一个 arena（循环链表）
  struct malloc_state *next_free;   // 下一个空闲 arena
  INTERNAL_SIZE_T attached_threads; // 绑定的线程数
  INTERNAL_SIZE_T system_mem;       // 已分配的系统内存
  INTERNAL_SIZE_T max_system_mem;   // 系统内存峰值
};
```

Arena 是 ptmalloc 中独立的内存分配区，每个 Arena 管理自己的 bins 和 top chunk。多线程环境下，每个线程优先使用自己的 Arena，减少锁竞争。

其中`main_arena`最为特殊，它是`struct malloc_state`的一个全局实例，在`libc`中定义如下：

```c
static struct malloc_state main_arena =
{
  .mutex = _LIBC_LOCK_INITIALIZER,
  .next = &main_arena,
  .attached_threads = 1
};
```

这个全局变量十分重要，它位于`libc.so`的数据段中，其地址和`libc`基址之间有着固定的偏移地址。也就是说我们可以通过泄露`main_arena`地址的方式来泄露`libc`的基址。具体的方法之后会在计算机安全的堆中进一步讨论这个利用。

