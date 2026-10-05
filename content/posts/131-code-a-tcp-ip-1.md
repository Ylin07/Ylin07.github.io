---
title: "code a TCP/IP(1)"
date: 2026-07-08T06:23:27.475Z
series: "从零实现 TCP/IP"
weight: 1
---

找到一个不错的教程 -> [Let's code a TCP/IP stack, 1: Ethernet & ARP](https://www.saminiir.com/lets-code-tcp-ip-stack-1-ethernet-arp/)

这个教程是教你如何一步一步的从基础实现TCP/IP的协议，使用的是C语言，不过我没有仔细看多少，打算平时没事的时候就对着复现一下。

## 以太网与ARP协议

TCP作为传输层协议，向下依赖于网络层->数据链路层->物理层。所以再正式实现TCP的协议之前，我们需要做好基础的准备，以向上层提供服务。

### TUN/TAP设备

我们的开发环境是在Linux环境下，为了从内核中截获网络流量，我们需要用到TUN/TAP设备。他们是操作系统内核提供的虚拟网卡驱动，通过这两个虚拟设备，我们就可以在用户空间中收发网络流量。

其中TUN和TAP设备分别模拟了两个不同的层级：

+ **TUN：** 收到的数据是从IP头部开始的完整报文（相当于虚拟路由器）
+ **TAP**：收到的数据是包含14字节的以太网头的完整帧（相当于虚拟网卡）

由于我们希望从第二层开始构建整个网络架构，因此需要使用TAP设备，创建方式如下：

```c
int tun_alloc(char *dev){
    struct ifreq ifr;
    int fd, err;

    if((fd = open("/dev/net/tun",O_RDWR)) < 0){
        perror("Connot open TUN/TAP dev\n");
        exit(1);
    }

    memset(&ifr, 0, sizeof(ifr));
	
    // IFF_TAP 代表TAP设备  IFF_NO_PI 要求以太网帧头不要不必要的数据包信息
    ifr.ifr_flags = IFF_TAP | IFF_NO_PI;
    if(*dev){
        strncpy(ifr.ifr_name, dev, IFNAMSIZ);
    }
	// ioctl按照配置生成对应的设备 并将其绑定到fd
    if((err = ioctl(fd, TUNSETIFF, (void *)&ifr)) < 0){
        perror("ERR: Could not ioctl tun\n");
        close(fd);
        return err;
    }
	// 将内核中的设备名拷贝出来
    strcpy(dev, ifr.ifr_name);
    return fd;
}
```

之后我们就可以通过返回的文件描述符`fd`，使用`read`和`write`来对虚拟设备进行读写。

## 以太网帧的格式

我们需要了解以太网帧的头部结构。从而进一步的对其进行操作，在C语言中，我们将其定义为以下结构体：

```c
#include <linux/if_ether.h>
#define ETH_ALEN	6		/* Octets in one ethernet addr	 */

struct ethhdr {
	unsigned char	h_dest[ETH_ALEN];	/* destination eth addr	*/
	unsigned char	h_source[ETH_ALEN];	/* source ether addr	*/
	__be16		h_proto;		/* packet type ID field	*/
} __attribute__((packed));
```

转换成以下形式可能会便于理解一点，二者几乎是等价的

```c
struct eth_hdr
{
    unsigned char dmac[6];
    unsigned char smac[6];
    uint16_t ethertype;
    unsigned char payload[];
} __attribute__((packed));
```

+ `dmc `和 `smac` ：分别是通信双方的MAC地址
+ `ethertype`：是一个16位的字段，只不过是网络字节序（即大端序）
+ `payload`：指向以太网帧有效载荷的指针。在我们的情况下，有效载荷主要是`ARP/IPv4`，有效载荷至少要48字节，最多1500字节，少的部分需要填充。

在以太网帧的末尾其实还有个校验和字段，但是这里我们不做处理。这里的`__attribute__((packed))`目的是确保编译过程中，结构体的内存布局不被优化改变。

后续我们对以太网帧的处理也很直观：

```c
if (tun_read(buf, BUFLEN) < 0) {
    print_error("ERR: Read from tun_fd: %s\n", strerror(errno));
}

eth_hdr *hdr = init_eth_hdr(buf);

// 根据以太网包头的ethertype字段做后续处理
handle_frame(&netdev, hdr);
```

函数具体实现后续会补充

## ARP协议

ARP协议也就是地址解析协议，用于将48位的以太网地址动态映射为协议地址（如Ipv4）地址。在局域网内，我们通常知道某个服务的IP地址。但是在实际的通信中我们还需要知道设备的硬件地址MAC。ARP协议的人俗就是用来在网络中查询信息，要求IP地址的所有者返回MAC地址

ARP包的数据格式如下：

```c
#include <linux/if_arp.h>
struct arphdr {
	__be16		ar_hrd;		/* format of hardware address	*/
	__be16		ar_pro;		/* format of protocol address	*/
	unsigned char	ar_hln;		/* length of hardware address	*/
	unsigned char	ar_pln;		/* length of protocol address	*/
	__be16		ar_op;		/* ARP opcode (command)		*/

#if 0
	 /*
	  *	 Ethernet looks like this : This bit is variable sized however...
	  */
	unsigned char		ar_sha[ETH_ALEN];	/* sender hardware address	*/
	unsigned char		ar_sip[4];		/* sender IP address		*/
	unsigned char		ar_tha[ETH_ALEN];	/* target hardware address	*/
	unsigned char		ar_tip[4];		/* target IP address		*/
#endif
};
```

当然这个还是太复杂了，我们转换成以下形式：

```c
struct arp_hdr
{
    uint16_t hwtype;
    uint16_t protype;
    unsigned char hwsize;
    unsigned char prosize;
    uint16_t opcode;
    unsigned char data[];
} __attribute__((packed));
```

+ `hwtype`：改字段用于确定链路层类型。
+ `protype`：用于表示协议类型
+ `hwsize`和`prosize`：分别表示硬件和协议字段的大小
+ `opcode`：用于指定ARP消息的类型，这个值可以是ARP请求(1)、ARP回复(2)、RARP请求(3)、RARP回复(4)
+ `data`：包含ARP消息的实际有效载荷。在我们的场景下，该字段会包含与IPv4相关的消息，也就是这一部分（看注释就可以理解）：

```c
#if 0
	 /*
	  *	 Ethernet looks like this : This bit is variable sized however...
	  */
	unsigned char		ar_sha[ETH_ALEN];	/* sender hardware address	*/
	unsigned char		ar_sip[4];		/* sender IP address		*/
	unsigned char		ar_tha[ETH_ALEN];	/* target hardware address	*/
	unsigned char		ar_tip[4];		/* target IP address		*/
#endif
```

可以转换成以下数据格式：

```c
struct arp_ipv4
{
    unsigned char smac[6];
    uint32_t sip;
    unsigned char dmac[6];
    uint32_t dip;
} __attribute__((packed));
```



## ARP解析算法

下面就是地址解析算法的详细规范：

```sh
?Do I have the hardware type in ar$hrd?
Yes: (almost definitely)
  [optionally check the hardware length ar$hln]
  ?Do I speak the protocol in ar$pro?
  Yes:
    [optionally check the protocol length ar$pln]
    Merge_flag := false
    If the pair <protocol type, sender protocol address> is
        already in my translation table, update the sender
        hardware address field of the entry with the new
        information in the packet and set Merge_flag to true.
    ?Am I the target protocol address?
    Yes:
      If Merge_flag is false, add the triplet <protocol type,
          sender protocol address, sender hardware address> to
          the translation table.
      ?Is the opcode ares_op$REQUEST?  (NOW look at the opcode!!)
      Yes:
        Swap hardware and protocol fields, putting the local
            hardware and protocol addresses in the sender fields.
        Set the ar$op field to ares_op$REPLY
        Send the packet to the (new) target hardware address on
            the same hardware on which the request was received.
```

简单说就是，当一个网卡收到一个ARP请求包时，先依次检查前面的字段，然后再对自身进行查表。先对发送方的IP地址和MAC地址的映射关系进行学习，然后请求的目标IP是否属于自己，如果属于，则返回一个应答报文给发送地址。其中`translation table`作为缓存，存放每个网卡学习到的映射关系。

现在我们可以开始尝试将我们所学到的整合起来，实现一个简单的arp协议功能

## 实践

首先我们按照设备的功能进行封装，首先TUN设备：

```c
#ifndef TUN_H
#define TUN_H

int tun_init();

int tun_read(void *buf, int len);
int tun_write(void *buf, int len);

int tun_free();

#endif
```

```c
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <net/if.h>
#include <fcntl.h>
#include <linux/if_tun.h>

#include "tun.h"

static int tun_fd = -1;
static char *dev = NULL;

static int tun_alloc(char *dev){
    struct ifreq ifr;
    int fd, err;

    if((fd = open("/dev/net/tun",O_RDWR)) < 0){
        perror("Connot open TUN/TAP dev\n");
        exit(1);
    }

    memset(&ifr, 0, sizeof(ifr));

    ifr.ifr_flags = IFF_TAP | IFF_NO_PI;
    if(*dev){
        strncpy(ifr.ifr_name, dev, IFNAMSIZ);
    }

    if((err = ioctl(fd, TUNSETIFF, (void *)&ifr)) < 0){
        perror("ERR: Could not ioctl tun\n");
        close(fd);
        return err;
    }

    strcpy(dev, ifr.ifr_name);
    return fd;
}

int tun_init(){
    if(tun_fd >= 0)
        return 0;
    if((dev = calloc(IFNAMSIZ, sizeof(char))) = NULL){
        perror("ERR: Could not calloc dev\n");
        return -1;
    }
    strncpy(dev, "tap0", IFNAMSIZ);
    tun_fd = tun_alloc(dev);

    printf("TAP device created: %s\n", dev);
    return 0;
}

int tun_read(void *buf, int len){
    return read(tun_fd, buf, len);
}

int tun_write(void *buf, int len){
    return write(tun_fd, buf, len);
}

int tun_free()
{
    if (tun_fd >= 0) {
        close(tun_fd);
        tun_fd = -1;
    }

    free(dev);
    dev = NULL;

    return 0;
}
```

然后是ARP协议相关的实现：

```c
#ifndef ARP_H
#define ARP_H

int arp_init();

int arp_handle(void *buf, int len);

int arp_free();

#endif
```

```c
#include <linux/if_arp.h>
#include <linux/if_ether.h>
#include <netinet/in.h>
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <arpa/inet.h>

#include "tun.h"
#include "arp.h"


// #define ETH_P_IP 0x0800    // IP报文
// #define ETH_P_ARP 0x0806   // ARP报文
#define ARP_ETHERNET 1     

#define ARP_REQUEST 1
#define ARP_REPLY   2

// 以太网帧头结构
typedef struct{
    unsigned char dst[ETH_ALEN];
    unsigned char src[ETH_ALEN];
    uint16_t type;  
}__attribute__((packed)) eth_hdr;

// ARP报文结构
typedef struct{
    uint16_t hwtype;
    uint16_t protype;
    unsigned char hwsize;
    unsigned char prosize;
    uint16_t opcode;
    unsigned char smac[ETH_ALEN];
    uint32_t sip;
    unsigned char tmac[ETH_ALEN];
    uint32_t tip;
}__attribute__((packed)) arp_hdr;

// ARP数据包结构
typedef struct{
    eth_hdr eth;
    arp_hdr arp;
}__attribute__((packed)) arp_pkt;

static int arp_initial = 0;
static uint32_t local_ip;
static unsigned char local_mac[6] = {
    0x02, 0x00, 0x00, 0x00, 0x00, 0x02
};

int arp_init(){
    if(arp_initial) return 0;
    if(inet_pton(AF_INET, "10.0.0.2", &local_ip) != 1){
        perror("ERR: Could not initialize ARP IP\n");
        return -1;
    }
    arp_initial = 1;
    return 0;
}

int arp_handle(void *buf, int len){
    arp_pkt *packet;
    arp_pkt reply;
    if(!arp_initial || buf==NULL) return -1;
    if(len < (int)sizeof(arp_pkt)) return 0;
    packet = buf;

    // 不是ARP包
    if(ntohs(packet->eth.type) != ETH_P_ARP) return 0;
    // 不是以太网 + IPv4 ARP
    if(ntohs(packet->arp.hwtype) != ARP_ETHERNET) return 0;
    if(ntohs(packet->arp.protype) != ETH_P_IP) return 0;
    // 暂时只处理ARP REQUEST
    if(ntohs(packet->arp.opcode) != ARP_REQUEST) return 0;
    // 暂时只请求本机IP
    if(packet->arp.tip != local_ip) return 0;

    memset(&reply, 0, sizeof(reply));
    // 以太网帧头部
    memcpy(reply.eth.dst, packet->arp.smac,ETH_ALEN);
    memcpy(reply.eth.src, local_mac,ETH_ALEN);
    reply.eth.type = htons(ETH_P_ARP);
    // ARP头部
    reply.arp.hwtype = htons(ARP_ETHERNET);
    reply.arp.protype = htons(ETH_P_IP);
    reply.arp.hwsize = ETH_ALEN;
    reply.arp.prosize = 4;
    reply.arp.opcode = htons(ARP_REPLY);
    memcpy(reply.arp.smac, local_mac, ETH_ALEN);
    reply.arp.sip = local_ip;
    memcpy(reply.arp.tmac, packet->arp.smac, ETH_ALEN);
    reply.arp.tip = packet->arp.sip;

    if(tun_write(&reply, sizeof(reply)) < 0){
        perror("ERR: Could not write ARP reply\n");
        return -1;
    }
    return 0;
}

int arp_free(){
    arp_initial = 0;
    local_ip = 0;
    return 0;
}

```

这里的实现比较基本，很多功能暂时也不是很完全，但是足以支持我们现在的实现了。

我们可以实现一个简单的应答程序：

```c
#include <stdio.h>

#include "arp.h"
#include "tun.h"

int main()
{
    unsigned char buf[2048];
    int len;

    if (tun_init() < 0) {
        fprintf(stderr, "Could not initialize TAP device\n");
        return -1;
    }

    if (arp_init() < 0) {
        fprintf(stderr, "Could not initialize ARP\n");
        tun_free();
        return -1;
    }

    printf("ARP program started\n");

    while (1) {
        len = tun_read(buf, sizeof(buf));

        if (len < 0) {
            perror("tun_read");
            break;
        }

        if (arp_handle(buf, len) < 0) {
            fprintf(stderr, "arp_handle failed\n");
            break;
        }
    }

    arp_free();
    tun_free();

    return 0;
}
```

并测试他是否能正确的回复信息：

```sh
[00:26:05] Ylin@Ylin /home/Ylin/Code/TCPIP
> sudo arping -I tap0 10.0.0.2
ARPING 10.0.0.2
42 bytes from 02:00:00:00:00:02 (10.0.0.2): index=0 time=86.957 usec
42 bytes from 02:00:00:00:00:02 (10.0.0.2): index=1 time=74.440 usec
42 bytes from 02:00:00:00:00:02 (10.0.0.2): index=2 time=99.222 usec
42 bytes from 02:00:00:00:00:02 (10.0.0.2): index=3 time=115.818 usec
42 bytes from 02:00:00:00:00:02 (10.0.0.2): index=4 time=237.495 usec
42 bytes from 02:00:00:00:00:02 (10.0.0.2): index=5 time=107.129 usec
```

测试成功！再此基础之上，我们可以添加更多的功能，如实现ARP的请求，对ARP的学习...

但是这都是之后的内容了。今天就到此为止了。

代码上传到github上面 [实现了基本的TAP设备创建 和 对ARP请求的回复 · Ylin07/Code-a-TCP-IP@ecb2a48](https://github.com/Ylin07/Code-a-TCP-IP/commit/ecb2a483ba7bf2d8d9b16211e796bcca2cbeaa8c)



