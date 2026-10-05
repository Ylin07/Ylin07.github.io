---
title: "编写一个HTTP服务器"
date: 2026-06-11T09:55:58.890Z
---

这个学期在学计算机网络，我终于开悟了。我之前一直是网络方面的白痴，这次的话就学习一个小的C语言网络编程的项目——“tinyhttpd”，主要是别记录边进行重写吧。加深一下对http协议的印象，顺便学习一下网络编程相关的知识。

# TinyHttp

## HTTP协议

HTTP是Web上客户端和服务器之间通信的应用层协议。它基于**响应-请求**模型，设计是无状态的（每次请求是独立的，不携带状态信息）

重要的是其报文格式，主要分为请求报文和响应报文，其有一定的通用结构：

+ **起始行(Start Line)**：描述请求方法/状态
+ **头部字段(Headers)**：以键值对形式存在，以`\r\n`字段结尾
+ **空行(CRLF)**：一个单独的`\r\n`，分隔头部和主体
+ **消息主体(Message Body)**：可选数据

其中头部字段常见的字段有：

+ **Host**：服务器主机名
+ **Content-Length**：主体长度
+ **Content-Type**：主体类型（如 `text/html`，`application/x-www-form-urlencoded`）
+ **Connection**：`keep-alive` 或 `close`（控制连接是否复用）
+ **User-Agent**：客户端标识

具体分析一下：

### 请求报文

主要的信息都在起始行：

```sh
<方法> <请求URI> <HTTP版本>\r\n
```

+ **方法**：如GET，POST，PUT，HEAD等
+ **请求URL**：通常情况下为“路径+查询字符串”，例如`/index.html?id=0721`
+ **HTTP版本**：这里我们写的是HTTP1.0

例如：

```http
GET /index.html?search=hello HTTP/1.1\r\n
Host: www.example.com\r\n
User-Agent: Mozilla/5.0\r\n
Accept: text/html\r\n
\r\n
（没有消息主体，因为 GET 一般不携带 body）
```

### 响应报文

最重要的是起始行：

```sh
<HTTP版本> <状态码> <状态描述>\r\n
```

+ **状态码**：表示处理结果，比如200，404，502...
+ **状态描述**：可读的状态，例如OK，Not Found...

例如：

```http
HTTP/1.1 200 OK\r\n
Content-Type: text/html\r\n
Content-Length: 128\r\n
\r\n
<html>...（128 字节内容）...
```

## HTTP服务器实现

接下来按照HTTP服务器想要处理报文需要的顺序，来分析源代码。首先我们要确保服务器程序能够接受网络连接：

#### startup()

```c
#include <stdio.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <stdint.h>
#include <unistd.h>
#include <string.h>

/*
    传入一个端口号的指针，返回创建好的server socket文件描述符
    如果传入值为0，自动分配一个，并通过指针port写回实际端口
*/ 
int startup(uint16_t *port)
{
    // socket 用来创建一个通信端点 
    // 这里相当于打开一个网络设备 返回设备描述符
    int httpd = socket(PF_INET, SOCK_STREAM, 0);
    if(httpd == -1){
        fprintf(stderr, "socket error\n");
        return -1;
    }

    // 填充地址结构体
    struct sockaddr_in name;
    memset(&name, 0, sizeof(name));
    name.sin_family = AF_INET;
    name.sin_port = htons(*port);
    name.sin_addr.s_addr = htonl(INADDR_ANY);

    // bind 将socket和地址结构体绑定
    if(bind(httpd, (struct sockaddr *)&name, sizeof(name)) == -1){
        fprintf(stderr, "bind error\n");
        return -1;
    }

    // 如果传入的端口号为0，说明需要自动分配一个端口号
    if(*port == 0){
        socklen_t namelen = sizeof(name);
        getsockname(httpd, (struct sockaddr *)&name, &namelen);
        *port = ntohs(name.sin_port);
    }

    // 开启监听 这里的5代表最多能有5个客户端排队等待连接
    if(listen(httpd, 5) == -1){
        fprintf(stderr, "listen error\n");
        return -1;
    }
    return httpd;
}
```

我们可以通过编写main和使用nc来测试是否成功开启端口，以完成网络连接：

```c
int main()
{
    uint16_t port = 0;
    int server_socket = startup(&port);
    struct sockaddr_in client;
    socklen_t client_len = sizeof(client);
    printf("Server started on port %d\n", port);
    int client_socket = accept(server_socket, (struct sockaddr *)&client, &client_len);
    printf("Client connected\n");
    close(client_socket);
    close(server_socket);
    return 0;
}
```

我们运行得到以下结果：（注意这两条命令是同时进行的 connect在nc之后）

```bash
[20:08:03] Ylin@Ylin /home/Ylin/code/C/tinyHttp
> nc localhost 45683
[20:07:50] Ylin@Ylin /home/Ylin/code/C/tinyHttp
> ./httpd
Server started on port 45683
Client connected
```

能够成功建立连接之后我们需要接收远程的信息，并进一步的对HTTP报文进行解析了。而HTTP是基于行的文本协议，以`\r\n`结尾，我们需要一个函数能从`recv()`的信息中精确的读出一行。所以下一步我们需要实现一个`get_line()`函数。

### get_line()

```c
/* 
    用来从sock字节流中读取行信息，返回读取的字节数
    指定size大小避免缓冲区溢出
*/
int get_line(int sock,char *buf, int size)
{
    int i = 0;
    char c = '\0';  // 字符存放变量 因为这里我们采用逐字节读取
    int n;
    while ((i < size-1) && (c != '\n')){
        n = recv(sock, &c, 1, 0);
        if(n>0){
            // 如果是'\r'开头
            if(c == '\r'){
                // 使用MSG_PEEK预读取一个字符 看看是不是'\n'
                n = recv(sock, &c, 1, MSG_PEEK);
                // 如果是'\n'则读取出来
                if((n > 0) && (c == '\n'))
                    recv(sock, &c, 1, 0);
                // 不是则赋值为'\n'跳出循环
                else
                    c = '\n';
            }
            buf[i++] = c;
        }else{
            c = '\n';
        }
    }
    buf[i] = '\0';
    return i;
}
```

有了行读取的工具函数之后，我们可以从socket中获得部分HTTP报文的信息了，比如HTTP的请求头信息。我们可以在刚刚的main函数基础上加入读取功能。

```c
int main()
{
    uint16_t port = 0;
    int server_socket = startup(&port);
    struct sockaddr_in client;
    socklen_t client_len = sizeof(client);
    printf("Server started on port %d\n", port);
    int client_socket = accept(server_socket, (struct sockaddr *)&client, &client_len);
    
    char buf[1024];
    while(get_line(client_socket, buf, sizeof(buf)) > 0){
        printf("%s",buf);
        if(buf[0] == '\n')
            break;
    }
    close(client_socket);
    close(server_socket);
    return 0;
}
```

编译运行后在浏览器访问`http://localhost:port`，得到以下头部信息：

```sh
[20:53:45] Ylin@Ylin /home/Ylin/code/C/tinyHttp
> ./httpd
Server started on port 47719
GET / HTTP/1.1
Host: localhost:47719
Connection: keep-alive
sec-ch-ua: "Microsoft Edge";v="149", "Chromium";v="149", "Not)A;Brand";v="24"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Windows"
Upgrade-Insecure-Requests: 1
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7
Sec-Fetch-Site: none
Sec-Fetch-Mode: navigate
Sec-Fetch-User: ?1
Sec-Fetch-Dest: document
Accept-Encoding: gzip, deflate, br, zstd
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6
Cookie: Webstorm-92b06e5e=8b058e01-09b4-4d46-9c37-dee306d3bf7a
```

能够获取报文之后，我们需要进一步的对http的请求进行解析了，我们先从第一行解析HTTP请求开始，为此我们需要实现一个`accept_request()`函数。

### accept_request()

这个函数是整个项目的关键，起到一个承上启下的功能。每当有一个客户端连接进来都会调用一次这个函数。

+ 首先解析出 `method` 和 `url`
+ 判断方法：
  + 如果是`POST`，后续需要解析相关的`CGI`
  + 如果不是`POST`或`GET`，返回`501`
+ 如果URL带`query_string`，将其分离出来并标记为`CGI`
+ 解析真实路径，进行拼接，并追加`index.html`
+ 检查目录是否存在
+ 后续进行路由

根据以上需求，我们可以写出：

```c
#include <ctype.h>		// 引入isspace
#include <sys/stat.h>	// 用来查询文件属性
/*
    用来解析请求头,clien是客户端socket
*/
void accept_requset(int client){
    char buf[1024];
    char method[1024];
    char url[255];
    char path[512]; 
    int cgi = 0;        // 是否执行CGI
    char *query_string = NULL;

    // 读取请求行
    get_line(client, buf, sizeof(buf));
    // 从请求行解析method 空格截断
    size_t i=0;
    while(!isspace(buf[i]) && (i < sizeof(method) - 1)){
        method[i] = buf[i++];
    }
    method[i] = '\0';
    // 只支持GET和POST
    if(strcmp(method,"GET") && strcmp(method,"POST")){
        unimplemented(client);
        return;
    }
    // 如果是POST方法则需要执行CGI
    if(strcmp(method,"POST") == 0)
        cgi = 1;
    // 从请求行解析url 空格截断
    size_t j=0;
    while(isspace(buf[i]) && (i < sizeof(buf)))
        i++;
    while(!isspace(buf[i]) && (j < sizeof(url) - 1) && (i < sizeof(buf)))
        url[j++] = buf[i++];
    url[j] = '\0';
    // 如果是GET方法则需要判断是否有查询字符串
    if(strcmp(method,"GET")==0){
        query_string = url;
        while((*query_string != '?') && (*query_string != '\0'))
            query_string++;
        if(*query_string == '?'){
            *query_string = '\0';
            query_string++;
            cgi = 1;
        }
    }
    // 构建文件路径
    sprintf(path, "htdocs%s", url);
    // 如果路径以'/'结尾则默认访问index.html
    if(path[strlen(path)-1] == '/')
        strcat(path, "index.html");
    // 判断文件是否存在 直接查询文件元数据
    struct stat st;
    if(stat(path, &st) == -1){
        // 文件不存在 丢弃请求头并返回404
        while((get_line(client, buf, sizeof(buf))) > 0 && strcmp(buf, "\n"))
            ;
        not_found(client);
    }else{
        // 如果是目录则默认访问index.html
        if(S_ISDIR(st.st_mode))
            strcat(path, "/index.html");
        // 判断文件是否可执行
        if((st.st_mode & S_IXUSR) || (st.st_mode & S_IXGRP) || (st.st_mode & S_IXOTH))
            cgi = 1;
        // 路由后续处理
        if(cgi)
            execute_cgi(client, method, path, query_string);
        else
            serve_file(client, path);
    }
    close(client);
}
```

这里就不进行测试了。接下来我们还需要完成一系列辅助响应函数：

+ **headers()**：静态文件响应头 -> 200
+ **not_found()**：文件不存在 -> 404
+ **unimplemented()：** 不支持的HTTP方法 -> 501
+ **bad_request()**：请求格式错误 -> 400
+ **cannot_execute()：** CGI执行失败 -> 500

接下来一个个实现：

```c
/*
    辅助响应函数
    headers() —— 发送成功响应头（200 OK）
    not_found() —— 404 页面
    unimplemented() —— 501 方法不支持
    bad_request() —— 400 请求错误
    cannot_execute() —— 500 CGI 执行失败
*/
void headers(int client, const char *filename){
    char buf[1024];
    (void)filename; // 后续会进一步使用
    sprintf(buf, "HTTP/1.0 200 OK\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "Content-Type: text/html\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "\r\n");
    send(client, buf, strlen(buf), 0);
    printf("200 OK\n");
}

void not_found(int client)
{
    char buf[1024];
    sprintf(buf, "HTTP/1.0 404 NOT FOUND\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "Content-Type: text/html\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "<HTML><TITLE>Not Found</TITLE>\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "<BODY><P>The server could not fulfill\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "your request because the resource specified\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "is unavailable or nonexistent.\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "</BODY></HTML>\r\n");
    send(client, buf, strlen(buf), 0);
    printf("404 NOT FOUND\n");
}

void unimplemented(int client)
{
    char buf[1024];
    sprintf(buf, "HTTP/1.0 501 Method Not Implemented\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "Content-Type: text/html\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "<HTML><HEAD><TITLE>Method Not Implemented\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "</TITLE></HEAD>\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "<BODY><P>HTTP request method not supported.\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "</BODY></HTML>\r\n");
    send(client, buf, strlen(buf), 0);
    printf("501 Method Not Implemented\n");
}

void bad_request(int client)
{
    char buf[1024];
    sprintf(buf, "HTTP/1.0 400 BAD REQUEST\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "Content-Type: text/html\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "<P>Your browser sent a bad request, ");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "such as a POST without a Content-Length.\r\n");
    send(client, buf, strlen(buf), 0);
    printf("400 BAD REQUEST\n");
}

void cannot_execute(int client)
{
    char buf[1024];
    sprintf(buf, "HTTP/1.0 500 Internal Server Error\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "Content-Type: text/html\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "\r\n");
    send(client, buf, strlen(buf), 0);
    sprintf(buf, "<P>Error prohibited CGI execution.\r\n");
    send(client, buf, strlen(buf), 0);
    printf("500 Internal Server Error\n");
}
```

加上辅助响应函数之后，我们就可以看到错误信息了

`accept_request()`之后需要根据`cgi`路由到`serve_file()`和`execute_cgi()`，这里先实现静态文件服务。我们需要实现实现一个`cat()`来完成对静态文件的读取。

### serve_file()

在`serve_file()`调用之前，我们只读取了请求头的第一行，剩下的请求头部字段我们全都不要，但是我们需要将其读出来，否则会一直残留在`socket`的缓冲区中。

```c
/*
    处理静态文件
    cat 负责将文件内容通过socket发送到客户端
    serve_file 负责提供静态文件服务 
*/
void cat(int client, FILE *fp)
{
    char buf[1024];
    fgets(buf, sizeof(buf), fp);
    // 如果没有到文件末尾则继续读取
    while(!feof(fp)){
        send(client, buf, strlen(buf), 0);
        fgets(buf, sizeof(buf), fp);
    }
}

void serve_file(int client, const char *filename)
{
    FILE *fp = NULL;
    char buf[1024];

    // 丢弃剩余请求头
    while((get_line(client, buf, sizeof(buf)) > 0) && (strcmp(buf,"\n")))
        ;

    // 打开文件
    fp = fopen(filename, "r");
    if(fp == NULL){
        not_found(client);
        return;
    }
    headers(client, filename);
    cat(client, fp);
    fclose(fp);
}
```

现在我们可以测试一下，先往`htdocs`下面放个简单的html资源：

```html
<HTML>
<HEAD><TITLE>TinyHTTP Test</TITLE></HEAD>
<BODY>
<H1>Hello from Ylin!</H1>
<P>It works!</P>
</BODY>
</HTML>
```

然后我们运行服务器程序，在网页上访问它，能够正常访问

![](https://files.seeusercontent.com/2026/06/12/Czm1/pasted-image-1781279695174.webp)

现在我们解决了处理静态文件的问题，我们需要添加逻辑来处理`CGI`，HTTP服务器不自己处理动态逻辑，所以我们需要`fork()`一个子进程来专门处理外部脚本，而父子进程之间通过管道来传递数据。我们需要写出完成对`CGI`的执行函数

### execute_cgi()

首先我们需要创建两个管道来确保父子进程能够正常的通信。然后我们应该像先前的`server_file()`一样，读取并丢弃没用的请求头：

+ 对于GET没有请求体，直接丢弃所有的请求头
+ 对于POST则需要从请求头中提取`Content-Length`即可

然后就是发送状态行，之后就要准备创建父子进程了。接下来的部分比较难，我会在源码中详细注释：

```c
#include <stdlib.h>
#include <sys/wait.h>
#include <assert.h>
/*
    处理动态内容
    execute_cgi 负责执行CGI程序并将结果发送到客户端
*/
void execute_cgi(int client, const char *method, const char *path, const char *query_string)
{
    char buf[1024];
    // 子进程通过[1]写输出 父进程从[0]读
    int cgi_out[2];
    // 父进程通过[1]写POST body 子进程从[0]读
    int cgi_in[2];
    pid_t pid;
    int status;
    int content_length = -1;

    // 读取并丢弃请求头
    if(strcmp(method, "GET") == 0){
        while((get_line(client, buf, sizeof(buf)) > 0) && (strcmp(buf, "\n")))
            ;
    }else{
        // POST方法需要读取Content-Length头部
        while((get_line(client, buf, sizeof(buf)) > 0) && (strcmp(buf, "\n"))){
            // 截断字符串
            buf[15] = '\0';
            if(strcmp(buf, "Content-Length:") == 0)
                content_length = atoi(&buf[16]);
        }
        if(content_length == -1){
            bad_request(client);    // 没有Content-Length头部则返回400错误
            return;
        }
    }
    // 发送状态行
    sprintf(buf, "HTTP/1.0 200 OK\r\n");
    send(client, buf, strlen(buf), 0);
    // 创建管道
    if(pipe(cgi_out) < 0){cannot_execute(client);return;}
    if(pipe(cgi_in) < 0){cannot_execute(client);return;}
    // 创建子进程
    if((pid = fork()) < 0){cannot_execute(client);return;}

    if(pid == 0){   // 子进程
        dup2(cgi_out[1], STDOUT_FILENO);    // 子stdout -> cgi_out[1]
        dup2(cgi_in[0], STDIN_FILENO);      // 子stdin -> cgi_in[0]
        close(cgi_out[0]);
        close(cgi_in[1]);
        // 设置环境变量 HTTP规定CGI程序通过环境变量获取请求信息
        setenv("REQUEST_METHOD", method, 1);
        if(strcmp(method, "GET") == 0){
            setenv("QUERY_STRING", query_string ? query_string : "", 1);
        }else{
            char len_str[16];
            sprintf(len_str, "%d", content_length);
            setenv("CONTENT_LENGTH", len_str, 1);
        }
        // 执行CGI程序
        execl(path, path, NULL);
        assert(0);   // 如果execl返回说明执行失败
        exit(1);
    }else{          // 父进程
        close(cgi_out[1]);
        close(cgi_in[0]);
        if(strcmp(method, "POST") == 0){
            // 从客户端读取POST body并写入cgi_in管道
            for(int i=0; i<content_length; i++){
                recv(client, buf, 1, 0);
                write(cgi_in[1], buf, 1);
            }
        }
        // 从cgi_out管道读取CGI程序输出并发送到客户端
        close(cgi_in[1]);   // 提前关闭写入端 让子进程收到EOF
        int n;
        while(( n = read(cgi_out[0], buf, sizeof(buf))) > 0)
            send(client, buf, n, 0);
        close(cgi_out[0]);

        waitpid(pid, &status, 0);   // 等待子进程结束
    }
}
```

关于这一部分的测试需要在后面做，所以暂时先跳过。

现在我们已经实现了`serve_file()`和`execute_cgi()`，分别实现了对静态文件和动态CGI的执行，现在我们可以进一步的完善我们的`main()`，实现多线程接受连接。真正的服务器需要无限循环接受连接，每个连接使用一个新的线程来处理。

### main()

这里涉及到一些线程的用法，我也不是很熟悉不过也是学到了：

```c
void *accept_request_thread(void *arg){
    int client = *(int *)arg;
    free(arg);
    accept_request(client);
    return NULL;
}


int main()
{
    uint16_t port = 0;
    int server_socket = startup(&port);
    struct sockaddr_in client;
    socklen_t client_len = sizeof(client);

    while(1){
        int client_socket = accept(server_socket, (struct sockaddr *)&client, &client_len);
        if(client_socket == -1){
            fprintf(stderr,"accept error\n");
            continue;
        }
        int *pclient = malloc(sizeof(int));
        *pclient = client_socket;

        pthread_t tid;
        if(pthread_create(&tid, NULL, accept_request_thread, pclient) != 0){
            fprintf(stderr,"pthread_create error\n");
            close(client_socket);
            free(pclient);
            continue;
        }
        // 分离线程 结束后自动回收资源
        pthread_detach(tid);
    }

    close(server_socket);
    return 0;
}
```

接下来就是激动人心得测试阶段。

## 编译测试

我先让AI给我写个帅气得测试用例，这里我选择用C写CGI实现一个扫雷程序：

![](https://files.seeusercontent.com/2026/06/13/Z9wu/pasted-image-1781361062302.webp)

哈哈 我会把所有内容放在github上[Ylin07/TinyHTTP: Learning by reimplementing TINYHTTP](https://github.com/Ylin07/TinyHTTP)
