---
title: NJU_PA_STUDY(4)
date: 2025-10-02 21:01:08
series: "NJU PA"
weight: 5
---
这一篇博客中,我将完成PA1的收尾部分，我将完成完成对表达式求值的功能拓展，和程序监视点的实现，预计要花费较多的时间。可能很多内容也需要好好学习理解一下。

# PA1 监视点

## 扩展表达式求值的功能

之前我们实现了算数表达式基本的求值（对整数的基本四则运算与结合律），但这些表达式都是常数组成的，他们的值不会发生变化，导致这样的表达式在监视点中没有任何意义，所以我们需要为我们的表达式拓展以下功能：

```shell
<expr> ::= <decimal-number>
  | <hexadecimal-number>    # 以"0x"开头
  | <reg_name>              # 以"$"开头
  | "(" <expr> ")"
  | <expr> "+" <expr>
  | <expr> "-" <expr>
  | <expr> "*" <expr>
  | <expr> "/" <expr>
  | <expr> "==" <expr>
  | <expr> "!=" <expr>
  | <expr> "&&" <expr>
  | "*" <expr>              # 指针解引用
```

那么首先我们就需要向框架中添加对应的解析，即更新程序的正则匹配逻辑：

```c
enum {
  TK_NOTYPE = 256, 
  TK_EQ, TK_NEQ, TK_AND,
  TK_HEX, TK_NUM, TK_REG,
};

static struct rule {
  const char *regex;
  int token_type;
} rules[] = {
  {" +", TK_NOTYPE},                // spaces
  {"==", TK_EQ},                    // equal
  {"!=", TK_NEQ},                   // unequal
  {"&&", TK_AND},                   // and
  {"\\+", '+'},                     // plus
  {"-", '-'},                       // minus
  {"\\*", '*'},                     // multi
  {"/", '/'},                       // div
  {"\\(", '('},                     // left brace
  {"\\)", ')'},                     // right brace
  {"0[xX][0-9a-fA-F]+", TK_HEX},    // hex number
  {"[0-9]+", TK_NUM},               // number
  {"\\$(zero|ra|sp|gp|tp|t[0-6]|s[0-9]|s1[0-1]|a[0-7])", TK_REG},   // reg
};
```

这里需要注意两个问题：

+ 一是 对于reg值得获取，框架代码在`/src/isa/$ISA/reg.c`中提供了`isa_reg_str2val()`作为接口，它将返回名字为s的寄存器的值，且设置success用于指示是否匹配成功。

+ 二是 我们需要注意到对指针解引用的识别，对于符号`*`它可能是乘号，也可能是对地址的解引用。实际上我们可以通过看其前一个标识的类型，我们就可以判断它的用法，所以可以给出框架代码如下:

  ```c
  if (!make_token(e)) {
    *success = false;
    return 0;
  }
  
  /* TODO: Implement code to evaluate the expression. */
  for (i = 0; i < nr_token; i ++) {						// certain type 视具体情况而定
    if (tokens[i].type == '*' && (i == 0 || tokens[i - 1].type == certain type) ) {
      tokens[i].type = DEREF;
    }
  }
  
  return eval(?, ?);
  ```

现在我们开始进一步的拓展我们的表达式的能力：

### 寄存器接口完善

我们需要根据`$`后的寄存器名，来获取对应的寄存器的值，并设置success:

```c
word_t isa_reg_str2val(const char *s, bool *success) {
  *success = true;
  if(!strcmp(s,"zero")) return 0;
  for(int i=0;i<32;i++){
    if(!strcmp(s,regs[i])) return cpu.gpr[i];
  }
  *success = false;
  return -1;
}
```

当发现寄存器返回值为-1时，则说明寄存器名称错误，我们要停止计算

### 表达式计算拓展

我们添加的功能有十六进制数的解析、寄存器的解析、还有部分简单逻辑运算的解析，我们依次分析，需要在哪些地方添加哪些功能：

首先是token的解析存储阶段：

```c
switch (rules[i].token_type) {
          case TK_HEX:
            tokens[nr_token].type = rules[i].token_type;
            for(int j=0;j<substr_len;j++)
              tokens[nr_token].str[j] = substr_start[j];
            tokens[nr_token].str[substr_len]='\0';
            break;
          case TK_NUM:  
            tokens[nr_token].type = rules[i].token_type;
            for(int j=0;j<substr_len;j++)
              tokens[nr_token].str[j] = substr_start[j];
            tokens[nr_token].str[substr_len]='\0';
            break;
          case TK_REG:
            tokens[nr_token].type = rules[i].token_type;
            for(int j=0;j<substr_len-1;j++)
              tokens[nr_token].str[j] = substr_start[j+1];
            tokens[nr_token].str[substr_len-1]='\0';
            break;
        ...
}
```

我们添加了对十六进制标识符和寄存器的存储。

同时我们也要注意在`eval()`，由于我们引入了十六进制和寄存器进入表达式解析中，所以对于最小的子表达式

```shell
<expr> ::= <decimal-number>
  | <hexadecimal-number>   
  | <reg_name>      
```

我们的解析应该展开为：

```c
...
else if(start==end){
    if(tokens[start].type==TK_REG){
      bool success = false;
      word_t val = isa_reg_str2val(tokens[start].str,&success);
      if(success) return val;
      printf("Invalid register name: %s\n", tokens[start].str);
      return -1;
    }
    return strtol(tokens[start].str,NULL,0);
}
...
```

由于我们添加了逻辑表达式，所以我们还需要更新其对表达式的拆分和运算，首先是运算部分：

```c
...
else{
    int op = get_token(start,end);
    if(op==-1){
      printf("Error: No valid operator found in expression\n");
      return -1;
    }
    word_t val1 = eval(start,op-1);
    word_t val2 = eval(op+1,end);
    switch(tokens[op].type){
      case TK_EQ: return (val1==val2);
      case TK_NEQ: return (val1!=val2);
      case TK_AND: return (val1&&val2);
      case '+': return val1+val2;
      case '-': return val1-val2; 
      case '*': return val1*val2;
      case '/': 
        if(val2==0){
          printf("Error: Division by 0\n");
          return -1;
        }
        return val1/val2;
      default: assert(0);
    }
  }
...
```

与之而来的问题是，在引入逻辑表达式之后，我们该怎么拆分我们的表达式呢？我们知道对于目前已有的运算符，我们有`* / > + - >逻辑运算`的优先级关系，所以我们可以根据上一节中的规则来更新我们的主运算符号的选择：

```c
static int get_token(int start, int end){
  int token = -1;
  int par = 0;
  int min_priority = -1;
  for(int i=start;i<=end;i++){
    int tmp=tokens[i].type;
    if(tmp==TK_NUM) continue;
    if(tmp=='(') par++;
    else if(tmp==')'){
      par--;
      if(par<0) return -1;
    }
    if(par!=0) continue;
    switch (tmp){
    case TK_EQ: case TK_NEQ: case TK_AND:
      if(min_priority<=3){
        min_priority=3;
        token=i;
      }
      break;
    case '*': case '/':
      if(min_priority<=1){
        min_priority=1;
        token=i;
      } 
      break;
    case '+': case '-':
      if(min_priority<=2){
        min_priority=2;
        token=i;
      } 
      break;
    default:
      continue;
    }
  }
  if(token != -1){
    // Log("Main operator: %c at position %d\n", tokens[token].type, token);
  } else {
    printf("No operator found in range [%d, %d]\n", start, end);
  }
  return token;
}

```

至此，我们就完成了对于运算符的解析和拓展。

### 解引用分析

最后我们还需要解决的一个问题就是对于指针的解引用，我们根据框架代码，对负号和解引用的标识符进行替换：

```c
word_t expr(char *e, bool *success) {
  if (!make_token(e)) {
    *success = false;
    return 0;
  }
  for(int i=0;i<nr_token;i++){
    if((tokens[i].type=='*'||tokens[i].type=='-')&&
        (i==0||
        tokens[i-1].type=='+'||
        tokens[i-1].type=='-'||
        tokens[i-1].type=='*'||
        tokens[i-1].type=='/'||
        tokens[i-1].type=='('||
        tokens[i-1].type==TK_AND||
        tokens[i-1].type==TK_EQ||
        tokens[i-1].type==TK_NEQ)
      ){
        if(tokens[i].type == '*') tokens[i].type = DEREF;
        else tokens[i].type = NEGATIVE;
    }
  }
  word_t val = eval(0,nr_token-1);
  *success = (val!=-1);
  return val;
}
```

由于他们都是一元运算符，在计算的过程中拥有最高的优先级，所以我们需要更新搜索主运算符的函数：

```c
...
switch (tmp){
    case DEREF: case NEGATIVE:
      if(min_priority<=0){
        min_priority=0;
        token=i;
      }
      break;
    case TK_EQ: case TK_NEQ: case TK_AND:
      if(min_priority<=3){
        min_priority=3;
        token=i;
      }
      break;
    case '*': case '/':
      if(min_priority<=1){
        min_priority=1;
        token=i;
      } 
      break;
    case '+': case '-':
      if(min_priority<=2){
        min_priority=2;
        token=i;
      } 
      break;
    default:
      continue;
    }
...
```

然后再最终的对表达式的整合中优先处理一元运算符号，再处理二元运算符：

```c
...
else{
    int op = get_token(start,end);
    if(op==-1){
      printf("Error: No valid operator found in expression\n");
      return -1;
    }

    if(tokens[op].type == DEREF || tokens[op].type == NEGATIVE) {
      word_t val = eval(op+1, end);
      if(val == -1) return -1;
      if(tokens[op].type == DEREF) return vaddr_read(val, 4);
      else return -val;
    }
    
    word_t val1 = eval(start,op-1);
    word_t val2 = eval(op+1,end);
    switch(tokens[op].type){
      case TK_EQ: return (val1==val2);
      case TK_NEQ: return (val1!=val2);
      case TK_AND: return (val1&&val2);
      case '+': return val1+val2;
      case '-': return val1-val2; 
      case '*': return val1*val2;
      case '/': 
        if(val2==0){
          printf("Error: Division by 0\n");
          return -1;
        }
        return val1/val2;
      default: assert(0);
    }
  }
...
```

至此我们完成了对表达式运算符的拓展。

## 实现监视点

监视器允许我们设置监视点，当监视点中的表达式满足时，`nemu`就将`nemu_state`设置成`NEMU_STOP`，此时我们就可以对程序状态进行观察。

不过首先我们需要能够将所有监视点管理组织起来，在框架代码中已经定义好了监视点的结构和监视点池的结构：

```c
typedef struct watchpoint {
  int NO;	// 监视器的编号
  struct watchpoint *next;

  /* TODO: Add more members if necessary */

} WP;

static WP wp_pool[NR_WP] = {};
static WP *head = NULL, *free_ = NULL;
```

我们需要管理两个链表`head`和`free_`。`head`用于存放使用中的监视点结构，`free_`用于组织空闲的监视点结构，我们可以使用`init_wp_pool()`函数，对两个链表进行初始化。

为了进一步的管理监视点池，我们需要两个函数：

+ `WP* new_wp()`：用于从空闲的监视点池中选择一个监视点进行使用，同时也要对剩余监视点的数量进行判断
+ `void free_wp(WP* wp)`： 用于将正在使用中的监视点存回空闲链表中

实现了对监视点池的管理之后，我们就需要实现监视点的相关功能了（以下是需要完成的要求）：

- 当用户给出一个待监视表达式时, 你需要通过`new_wp()`申请一个空闲的监视点结构, 并将表达式记录下来. 然后在`trace_and_difftest()`函数(在`nemu/src/cpu/cpu-exec.c`中定义)的最后扫描所有的监视点, 每当`cpu_exec()`的循环执行完一条指令, 都会调用一次`trace_and_difftest()`函数. 在扫描监视点的过程中, 你需要对监视点的相应表达式进行求值(你之前已经实现表达式求值的功能了), 并比较它们的值有没有发生变化, 若发生了变化, 程序就因触发了监视点而暂停下来, 你需要将`nemu_state.state`变量设置为`NEMU_STOP`来达到暂停的效果. 最后输出一句话提示用户触发了监视点, 并返回到`sdb_mainloop()`循环中等待用户的命令.
- 使用`info w`命令来打印使用中的监视点信息, 至于要打印什么, 你可以参考GDB中`info watchpoints`的运行结果.
- 使用`d`命令来删除监视点, 你只需要释放相应的监视点结构即可.

### 监视点池的管理

这里我想监视点的结构中添加了一个`used`属性，用来判断当前监视点是否被启用，据此，我们就可以实现对监视点池中的监视点的使用和空闲的操作：

```c
WP* new_wp(){
  if(free_==NULL){
    printf("No free watchpoint avilable\n");
    return NULL;
  }
  WP* wp = free_;
  free_ = free_->next;
  wp->used = 1;
  wp->next = head;
  head = wp;
  printf(ANSI_FMT("Create watchpoint #%d\n",ANSI_FG_BLUE),wp->NO);
  return wp;
}

void free_wp(WP* wp){
  if(wp==NULL||!wp->used) printf("Invalid watchpoint to free\n");
  if(head==wp){
    head = head->next;
  }else{
    WP* prev = head;
    while(prev!=NULL&&prev->next!=wp) prev = prev->next;
    if(prev!=NULL) prev->next = wp->next;
    wp->used=0;
    wp->next = free_;
    free_ = wp;
    printf(ANSI_FMT("Free watchpoint #%d\n",ANSI_FG_BLUE),wp->NO);
  }
}
```

现在我们需要进一步的完成监视点的功能，以及用于调用的接口

### 监视点功能实现

监视点的功能实际上就是在每一次执行之后，遍历一遍监视点链表，如果设置的表达式发生了改变，那么我们说监视点被触发了。所以我们要做的事情很简单，遍历计算表达式的值是否发生改变，如果是，则触发监视点：

```c
void wp_diff(){
  WP* wp = head;
  while(wp){
    bool _;
    word_t new = expr(wp->expr,&_);
    if(wp->val!=new){
      printf(ANSI_FMT("Watchpoint #%d: %s\n Old value = 0x%08x\n New value = 0x%08x\n",ANSI_FG_BLUE),wp->NO,wp->expr,wp->val,new);
      wp->val = new;
      nemu_state.state = NEMU_STOP;
    }
    wp = wp->next;
  }
}
```

由于NEMU在每次执行时都会在`execute()`中调用`trace_and_difftest()`我们在这个程序中加入每次对监视点的判断`wp_diff()`

现在我们只需要进一步完成监视点的接口，使得我们可以方便的创建销毁查看他们：

```c
P* new_wp(){
  if(free_==NULL){
    printf("No free watchpoint avilable\n");
    return NULL;
  }
  WP* wp = free_;
  free_ = free_->next;
  wp->used = 1;
  wp->next = head;
  head = wp;
  return wp;
}

WP* NO2wp(int i){
  return &wp_pool[i];
}

void free_wp(WP* wp){
  if(wp==NULL||!wp->used){printf("Invalid watchpoint to free\n");return;}
  if(head==wp){
    head = head->next;
  }else{
    WP* prev = head;
    while(prev!=NULL&&prev->next!=wp) prev = prev->next;
    if(prev!=NULL) prev->next = wp->next;
    wp->used=0;
    wp->next = free_;
    free_ = wp;
  }
  printf(ANSI_FMT("Free watchpoint #%d\n",ANSI_FG_BLUE),wp->NO);
}

void wp_set(char* expr,word_t val){
  WP* wp = new_wp();
  strcpy(wp->expr,expr);
  wp->val = val;
  printf(ANSI_FMT("Create watchpoint #%d: %s\n",ANSI_FG_BLUE),wp->NO,wp->expr);
}

void wp_display(){
  WP* tmp = head;
  while(tmp!=NULL){
    tmp = tmp->next;
  }
}
```

我们在终端进行调用，实现`info w`，`d NO`，`w EXPR`等功能：

```c
static int cmd_w(char* args){
  bool success = false;
  word_t val = expr(args,&success);
  if(!success){
    printf("Invalid expression: %s\n",args);
  }else{
    wp_set(args,val);
  }
  return 0;
}

static int cmd_d(char* args){
  int NO = atoi(args);
  free_wp(NO2wp(NO));
  return 0;
}

void wp_display(){
  WP* tmp = head;
  while(tmp!=NULL){
    printf("Watchpoint #%d -> %s\n",tmp->NO,tmp->expr);
    tmp = tmp->next;
  }
}
```

至此我们就实现了监视点的功能。

对于断点我们可以通过`w $pc=？`的方式来让程序停止

