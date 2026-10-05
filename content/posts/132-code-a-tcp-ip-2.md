---
title: "code a TCP/IP(2)"
date: 2026-07-14T08:33:09.519Z
series: "从零实现 TCP/IP"
weight: 2
---

上一章中我们实现了基本的ARP功能。但是仅限于回答ARP的请求包，我们还不能主动从虚拟网卡上向其他节点发送ARP的查询请求。同时我们也没有实现，对ARP映射关系的学习，即缓存功能。为了能够继续对IP层的学习，首先我们要做好数据链路层对上层的支持。

所以接下来我们将实现以下功能：

+ 将`arp_handle()`拆分成`arp_reply()`和`arp_request()`的处理模式，根据ARP包的类型来进行处理。
+ 实现对ARP的缓存功能，学习mac和ip地址的映射关系

改动后的程序如下：

```c
// arp_handle 功能拆分
static int arp_reply(const arp_pkt *packet){
    arp_pkt reply;

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
        perror("ERR: Could not write ARP reply");
        return -1;
    }
    return 0;
}

int arp_request(uint32_t target_ip){
    arp_pkt request;

    memset(&request, 0, sizeof(request));
    // 以太网头部
    // 目标地址所有位全为1时 广播发送请求
    memset(request.eth.dst, 0xff, ETH_ALEN);
    memcpy(request.eth.src, local_mac, ETH_ALEN);
    request.eth.type = htons(ETH_P_ARP);
    // ARP头部
    request.arp.hwtype = htons(ARP_ETHERNET);
    request.arp.protype = htons(ETH_P_IP);
    request.arp.hwsize = ETH_ALEN;
    request.arp.prosize = 4;
    request.arp.opcode = htons(ARP_REQUEST);

    memcpy(request.arp.smac, local_mac, ETH_ALEN);
    request.arp.sip = local_ip;
    // 由于request清零 所以mac默认是00:00:00:00:00:00 不用赋值
    request.arp.tip = target_ip;

    if(tun_write(&request, sizeof(request)) < 0){
        perror("ERR: Could not write ARP request");
        return -1;
    }
    return 0;
}

int arp_handle(void *buf, int len){
    arp_pkt *packet;
    uint16_t opcode;
    
    if(!arp_initial || buf==NULL) return -1;
    if(len < (int)sizeof(arp_pkt)) return 0;
    packet = buf;
    // 不是ARP包
    if(ntohs(packet->eth.type) != ETH_P_ARP) return 0;
    // 不是以太网 + IPv4 ARP
    if(ntohs(packet->arp.hwtype) != ARP_ETHERNET) return 0;
    if(ntohs(packet->arp.protype) != ETH_P_IP) return 0;
    // hwsize 和 prosize 要符合要求
    if(packet->arp.hwsize != ETH_ALEN) return 0;
    if(packet->arp.prosize != 4) return 0;

    opcode = ntohs(packet->arp.opcode);
    if(opcode == ARP_REQUEST){
        // 如果REQUEST请求不是本机的IP 则忽略
        if(packet->arp.tip != local_ip) return 0;
        return arp_reply(packet);
    }else if(opcode == ARP_REPLY){
        // 从packet中学习发送IP和发送mac的映射关系
        return 0;
    }
    return 0;
}
```

关于这一部分，具体的代码在->[优化了arp_handle()的处理 拆分成arp_reply和arp_request两个分析路径 同时预留了arp缓存的接口 · Ylin07/Code-a-TCP-IP@15c5a7e](https://github.com/Ylin07/Code-a-TCP-IP/commit/15c5a7e59a5b0f8f4ee5d7ca27264cdff2202ae1)

接下来是实现详细的缓存 和 学习功能：

```c
// 缓存结构
#define ARP_CACHE_SIZE 16
typedef struct{
    int valid;
    uint32_t ip;
    unsigned char mac[ETH_ALEN];
} arp_entry;
static arp_entry arp_cache[ARP_CACHE_SIZE];

static int arp_cache_find(uint32_t ip){
    int i;
    for(i=0; i<ARP_CACHE_SIZE; i++){
        if(arp_cache[i].valid && (arp_cache[i].ip == ip))
            return i;
    }
    return -1;
}

static int arp_cache_update(uint32_t ip, const unsigned char *mac){
    int i;
    int index;
    index = arp_cache_find(ip);
    if(index >= 0){
        memcpy(arp_cache[index].mac, mac, ETH_ALEN);
        return 0;
    }
    for(i=0; i<ARP_CACHE_SIZE; i++){
        if(!arp_cache[i].valid){
            arp_cache[i].valid = 1;
            arp_cache[i].ip = ip;
            memcpy(arp_cache[i].mac, mac, ETH_ALEN);
            return 0;
        }
    }
    arp_cache[0].valid = 1;
    arp_cache[0].ip = ip;
    memcpy(arp_cache[0].mac, mac, ETH_ALEN); 
    return 0;
}

int arp_lookup(uint32_t ip, unsigned char *mac){
    int index;
    if(mac == NULL) return -1;
    index = arp_cache_find(ip);
    if(index < 0) return -1;
    memcpy(mac, arp_cache[index].mac, ETH_ALEN);
    return 0;
}
```

还有一些细节没有放上去，比如init 和 free时都要清空缓存列表，以及在`handle`过程中每次都要学习对应的映射关系，但是这里就不过多展示了。然后就是编写了一个测试程序，用来从用户栈请求`tap0`的mac地址 效果如下：

```sh
> ip addr show tap0
7: tap0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UNKNOWN group default qlen 1000
    link/ether 9e:69:3a:b8:7c:1a brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.1/24 scope global tap0
       valid_lft forever preferred_lft forever

=============================================================================================
> sudo ./build/app
TAP device created: tap0
Configure tap0, then press Enter...

ARPING 10.0.0.1
Reply from 10.0.0.1 [9e:69:3a:b8:7c:1a]
```

关于这部分的代码和测试程序，具体的代码在->[实现了arp缓存与映射关系学习 以及编写了arping程序进行测试 · Ylin07/Code-a-TCP-IP@b0f4e69](https://github.com/Ylin07/Code-a-TCP-IP/commit/b0f4e696ecc5f9e44c3d913b005efa000ae90199)

现在我们终于可以正式开始今天的新的内容了。我们已经完成了从IP->mac的解析，完成了数据链路层对网络层提供得到重要服务之一。现在我们将在此基础之上实现基本的IP功能，我们将通过ICMP回显请求（即ping）来验证我们的工作。接下来的IP版本都是基于**IPv4**实现的

## IPv4

### 头部结构

IPv4头部由20个字节组成，其定义在`<netinet/ip.h>`

```c
struct ip
  {
#if __BYTE_ORDER == __LITTLE_ENDIAN
    unsigned int ip_hl:4;		/* header length */
    unsigned int ip_v:4;		/* version */
#endif
#if __BYTE_ORDER == __BIG_ENDIAN
    unsigned int ip_v:4;		/* version */
    unsigned int ip_hl:4;		/* header length */
#endif
    uint8_t ip_tos;			/* type of service */
    unsigned short ip_len;		/* total length */
    unsigned short ip_id;		/* identification */
    unsigned short ip_off;		/* fragment offset field */
#define	IP_RF 0x8000			/* reserved fragment flag */
#define	IP_DF 0x4000			/* dont fragment flag */
#define	IP_MF 0x2000			/* more fragments flag */
#define	IP_OFFMASK 0x1fff		/* mask for fragmenting bits */
    uint8_t ip_ttl;			/* time to live */
    uint8_t ip_p;			/* protocol */
    unsigned short ip_sum;		/* checksum */
    struct in_addr ip_src, ip_dst;	/* source and dest address */
  };
```

各字段具体含义如下：

+ `version`：使用的IP版本。IPv4是4
+ `ihl`：代表IP头部的长度，以4字节为单位，所以最小值为5
+ `tos`：服务质量相关，我们这里只设置为0
+ `len`：整个IP包的字节数，（头部 + 数据）
+ `id`：用于对数据报进行索引，可以帮助按顺序重组被分割的IP数据报。
+ `flags`：用于定义数据报的各种控制标志。
+ `offset`：用于指示片段在数据报中的位置，例如第一个数据报的索引就是0。(索引 = 数据报偏移//8)
+ `ttl`：这个IP包的生存时间，初始为64。每个接收方接受一次则减一，减为0则丢弃。
+ `proto`：上层协议号。`1`为ICMP，`6`为TCP，`17`为UDP
+ `sum`：16位的校验和，只需要校验头部
+ `src`和`dst`：源地址和目标地址(IPv4)

我们可以优化成以下数据结构：

```c
struct iphdr {
    uint8_t version : 4;
    uint8_t ihl : 4;
    uint8_t tos;
    uint16_t len;
    uint16_t id;
    uint16_t flags : 3;
    uint16_t frag_offset : 13;
    uint8_t ttl;
    uint8_t proto;
    uint16_t csum;
    uint32_t src;
    uint32_t dst;
} __attribute__((packed));
```

### 校验和

校验和字段用来验证IP数据报的完整性，其定义如下：

```text
The checksum field is the 16 bit one’s complement of the one’s complement sum of all 16 bit words in the header. For purposes of computing the checksum, the value of the checksum field is zero.
->
校验和字段是头部中所有 16 位数据的按位取反后的总和的 16 位补码形式。在计算校验和时，校验和字段的初始值为 0。
```

该算法的具体代码如下：

```c
uint16_t checksum(void *addr, int count)
{
    /* Compute Internet Checksum for "count" bytes
     *         beginning at location "addr".
     * Taken from https://tools.ietf.org/html/rfc1071
     */

    register uint32_t sum = 0;
    uint16_t * ptr = addr;

    while( count > 1 )  {
        /*  This is the inner loop */
        sum += * ptr++;
        count -= 2;
    }

    /*  Add left-over byte, if any */
    if( count > 0 )
        sum += * (uint8_t *) ptr;

    /*  Fold 32-bit sum to 16 bits */
    while (sum>>16)
        sum = (sum & 0xffff) + (sum >> 16);

    return ~sum;
}
```

对于IPv4相关的具体实现在这里->[添加了ipv4的实现 和 预留的对应接口 · Ylin07/Code-a-TCP-IP@8475254](https://github.com/Ylin07/Code-a-TCP-IP/commit/8475254d7bddfca0a0074d93935685228df3918a)

## ICMPv4

ICMP协议是互联网中的控制信息协议，我们常用其进行网络的故障诊断。当某个网关无法到达的时候，我们通过ICMP来返回错误信息。

### 头部格式

ICMP头部位于IP数据包的有效载荷中。其在头文件定义如下：

```c
struct icmphdr {
  __u8		type;
  __u8		code;
  __sum16	checksum;
  union {
	struct {
		__be16	id;
		__be16	sequence;
	} echo;
	__be32	gateway;
	struct {
		__be16	__unused;
		__be16	mtu;
	} frag;
	__u8	reserved[4];
  } un;
};
```

我们可以把data的内容放在之后再详细处理，这里我们可以把我们的结构抽象成

```c
struct icmp_hdr {
    uint8_t type;
    uint8_t code;
    uint16_t csum;
    uint8_t data[];
} __attribute__((packed));
```

这里解释一下各个字段的含义：

+ `type`-> 决定了ICMP的基本用途。这里我们只使用三种`回声应答0`、`目标地址不可达3`、`回声请求8`
+ `code`-> 进一步说明信息的含义，相当于对`type`的补充说明
+ `csum`-> 头部的检验字段，校验和的计算要包括数据载荷

###  消息及其处理过程

data包含的是icmp报文的实际信息。例如查询/信息性消息以及错误信息。我们这次的任务是实现回显请求/回复消息的功能，简单的来说就是实现一个"ping"

这种消息的格式如下：

```c
struct icmp_v4_echo {
    uint16_t id;
    uint16_t seq;
    uint8_t data[];
} __attribute__((packed));
```

其中各字段含义如下：

+ `id`：由发送方主机设置，用于帮助判断当前Reply/Request属于哪个ping会话，可以用来做进程分流
+ `seq`：用来区分请求的先后顺序，每当新的Echo请求发送，就将其+1
+ `data`：这个字段是可选的，通常包含一些有用信息，比如回声信号的产生时间戳。可以用来计算往返时间

一个ping的报文的包含关系就如下所示：

```c
Ethernet Frame
┌─────────────────────────────────────────┐
│ Ethernet Header                         │
│   EtherType = 0x0800                    │
├─────────────────────────────────────────┤
│ IPv4 Header                             │
│   protocol = 1，表示 ICMP               │
├─────────────────────────────────────────┤
│ ICMP Header                             │
│   type / code / checksum                │
├─────────────────────────────────────────┤
│ ICMP Echo 数据                          │
│   id / sequence / data                  │
└─────────────────────────────────────────┘
```

现在我们就可以编写出对应的Echo request程序

这个文章我写不下去了，太久没写了... 暑假一直在玩
