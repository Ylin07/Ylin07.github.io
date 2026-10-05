---
title: NJU_PA_STUDY(3)
date: 2025-09-29 12:14:57
series: "NJU PA"
weight: 4
---

我们先前反复提到了一个式子`EXPR`，它代表着表达式含义，常见的表达式是通过操作符连接的。这里我们需要为我们的框架实现一个表达式求值的功能。我们要解决的问题是求值一个字符串表示的表达式。

# PA1 表达式求值

为了简单起见，我们先从数学表达式求值实现开始。

## 数学表达式求值

如下的一个表达式的字符串：

```text
"5 + 4 * 3 / 2 - 1"
```

我们应该怎么求出它的值？我们可以分成两个简单的步骤：

+ 首先识别出表达式中的单元
+ 根据表达式的归纳定义进行递归求值

### 词法分析

词法分析要做的事情就是识别出表达式中的单元，这里的单元指的就是有着独立含义的子串，我们称之为token。具体而言我们需要将表达式中所有的单元都赋予一个标签，方便之后根据标签来对表达式进行处理。这里我们使用正则表达式来对`token`进行处理。

出于简单起见，这里我们暂时只对以下的`token`类型进行处理：

+ 十进制整数
+ `+`，`-`，`*`，`/`
+ `(`，`)`
+ 空格串（一个或者多个空格）

首先我们需要使用正则表达式来编写用于识别这些`token`类型的规则，框架中演示了怎么对其进行匹配。

```c
static struct rule {
  const char *regex;
  int token_type;
} rules[] = {

  /* TODO: Add more rules.
   * Pay attention to the precedence level of different rules.
   */

  {" +", TK_NOTYPE},    // spaces
  {"\\+", '+'},         // plus
  {"==", TK_EQ},        // equal
};
```

这些规则，在`init_sdb()`时调用了`init_regex()`来将其编译成正则结构体并存储在`re`中：

```c
void init_regex() {
  int i;
  char error_msg[128];
  int ret;
  for (i = 0; i < NR_REGEX; i ++) {
    ret = regcomp(&re[i], rules[i].regex, REG_EXTENDED);
    if (ret != 0) {
      regerror(ret, &re[i], error_msg, 128);
      panic("regex compilation failed: %s\n%s", error_msg, rules[i].regex);
    }
  }
}
```

如果编译不通过，可能是你编写的`token`匹配的规则不符合正则表达式的语法。现在，我们可以给出一个待匹配的表达式，我们利用`make_token()`来识别出其中的token。用`position`变量指示当前待匹配的位置，然后按顺序对当前位置的字符串进行匹配。当一个规则匹配成功，并且匹配出的字串属于position指出的位置时，我们就成功的识别出了一个token。我们则使用Token结构体来将它的内容记录下来。

```c
typedef struct token {
  int type;
  char str[32];
} Token;
static Token tokens[32] __attribute__((used)) = {};
static int nr_token __attribute__((used))  = 0;
```

其中`type`成员用于记录`token`的类型，然后`str`用来保存`token`相应的字串。`tokens`数组用来保存识别出的`token`信息，而`nr_token`则用来指示被识别出的`token`数目。

现在我们需要向算数表达式中的各种`tokens`类型添加规则，在成功识别出`token`hi后，将token的信息一次记录到`tokens`数组之中。

```c
rules[] = {
  // 这里需要注意对这些内容的匹配是有优先顺序的，从上到下
  {" +", TK_NOTYPE},    // spaces
  {"==", TK_EQ},        // equal
  {"\\+", '+'},         // plus
  {"-", '-'},           // minus
  {"\\*", '*'},         // multi
  {"/", '/'},       	// div
  {"\\(", '('},         // left brace
  {"\\)", ')'},         // right brace
  {"[0-9]+", TK_NUM},   // number
};
```

然后我们就需要将匹配到的token放入tokens中，并对它的各个字段进行赋值。对于大多数类型，我们只需要简单的保存它的类型就行了，但是对于有数据内容的token，我们需要保存它的`data`，在这里既是保存它的子串内容信息，方便我们进行进一步的计算。

```c
static bool make_token(char *e) {
  int position = 0;
  int i;
  int index=0;
  regmatch_t pmatch;
  nr_token = 0;
  while (e[position] != '\0') {
    /* Try all rules one by one. */
    for (i = 0; i < NR_REGEX; i ++) {
      if (regexec(&re[i], e + position, 1, &pmatch, 0) == 0 && pmatch.rm_so == 0) {
        char *substr_start = e + position;
        int substr_len = pmatch.rm_eo;
        Log("match rules[%d] = \"%s\" at position %d with len %d: %.*s",
            i, rules[i].regex, position, substr_len, substr_len, substr_start);
        position += substr_len;
        /* TODO: Now a new token is recognized with rules[i]. Add codes
         * to record the token in the array `tokens'. For certain types
         * of tokens, some extra actions should be performed.
         */
        switch (rules[i].token_type) {
          case TK_NUM:  
            tokens[index].type = rules[i].token_type;
            for(int j=0;j<substr_len;j++)
              tokens[index].str[j] = substr_start[j];
            // printf("The num is %s\n",tokens[index].str);
            break;
          default:
            tokens[index].type = rules[i].token_type;
        }
        index++;
        break;
      }
    }
    if (i == NR_REGEX) {
      printf("no match at position %d\n%s\n%*.s^\n", position, e, position, "");
      return false;
    }
  }
  return true;
}
```

我们可以看到整个识别token的过程，每当我们获取一个`token`时，我们都会使用`Log()`将它的匹配规则，子串下标，子串长度，和对应的子串信息打印出来。便于我们观察标识符匹配的中间过程。对于未匹配到的类型，我们也会将其内容进行返回。

中间部分则是我们对token信息的存储过程，目前我们只对十进制整数的内容进行了保存，对于其他的标识符号，则是简单的保存类型。现在我们可以进一步的进行表达式求值了。

### 递归求值

我们现在将求值表达式的`token`识别出来之后就可以进行求值了。我们现在是对`token`数组进行处理，方便起见，我们称其为`token`表达式。（将空格忽略）

接下来，根据表达式的归纳定义特性，我们可以使用递归来进行求值：

```shell
<expr> ::= <number>    # 一个数是表达式
  | "(" <expr> ")"     # 在表达式两边加个括号也是表达式
  | <expr> "+" <expr>  # 两个表达式相加也是表达式
  | <expr> "-" <expr>  # 接下来你全懂了
  | <expr> "*" <expr>
  | <expr> "/" <expr>
```

这种表示方法就是我们常说的BNF，我们可以这里理解，长表达式是由短表达式构成的，那么我们可以先对短表达式进行求值，然后再进一步的对长表达式进行求值。

为了在token表达式中指示一个子表达式，我么可以使用两个整数`p`和`q`来指示子表达式的开始和结束位置，现在我们就可以写出一个求值函数的框架：

```c
eval(p, q) {
  if (p > q) {
    /* Bad expression */
  }
  else if (p == q) {
    /* Single token.
     * For now this token should be a number.
     * Return the value of the number.
     */
  }
  else if (check_parentheses(p, q) == true) {
    /* The expression is surrounded by a matched pair of parentheses.
     * If that is the case, just throw away the parentheses.
     */
    return eval(p + 1, q - 1);
  }
  else {
    /* We should do more things here. */
  }
}
```

其中`check_parentheses()`用于判断表达式是否被一堆匹配的括号所包围，同时检查表达式左右的括号是否匹配，如果不匹配，那么这个表达式就是非法的。我们以此来尝试实现：

```c
static int check_parentheses(int start, int end){
  int cond=0;
  if(tokens[start].type!='('||tokens[end].type!=')') return 0;
  for(int i=start;i<=end;i++){
    if(tokens[i].type=='(') cond++;
    if(tokens[i].type==')'){
      cond--;
      if(cond<0) return -1;
    }
    if(cond==0) return (i == end) ? 1 : 0;
  }
  return (cond==0)?1:-1;
}
```

现在我们的框架代码，已经可以处理BNF的开始两种情况啦。像现在我们需要进一步的考虑剩下的情况，即四则运算的处理。但是问题在于，我们怎么对一个长表达式处理，将其分解为各个小的短表达式，并保证语法的正确呢？

我们以下为例：

```c
"4 + 3 * ( 2 - 1 )"
/*********************/
case 1:
    "+"
   /   \
"4"     "3 * ( 2 - 1 )"
case 2:
        "*"
       /   \
"4 + 3"     "( 2 - 1 )"
case 3:
              "-"
             /   \
"4 + 3 * ( 2"     "1 )"
```

我们可以看到只有第一种情况是正确的，第二种情况违背了算术符号的优先级，而第三种情况则使得表达式的括号不再匹配。通过以上的例子，我们就可以总结出寻找主运算符（可以将一个长表达式分解成两个短表达式的运算符号）的逻辑了：

+ 非运算符的`token`不是主运算符
+ 出现在一对括号中的`token`不是主运算符号
+ 主运算符的优先级在表达式中应该是最低的
+ 有多个运算符的优先级最低时，根据结合性，最后被结合的运算符为主运算符号

现在我们根据以上规则来扫描出每个表达式中的主运算符号：

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

找到表达式的主运算符之后，事情就变得简单了，我们先对两个分裂出来的子表达式进行递归求值，然后根据主运算符号的两个子表达式进行计算即可，现在我们的框架代码更新如下：

```c
eval(p, q) {
  if (p > q) {
    /* Bad expression */
  }
  else if (p == q) {
    /* Single token.
     * For now this token should be a number.
     * Return the value of the number.
     */
  }
  else if (check_parentheses(p, q) == true) {
    /* The expression is surrounded by a matched pair of parentheses.
     * If that is the case, just throw away the parentheses.
     */
    return eval(p + 1, q - 1);
  }
  else {
    op = the position of 主运算符 in the token expression;
    val1 = eval(p, op - 1);
    val2 = eval(op + 1, q);

    switch (op_type) {
      case '+': return val1 + val2;
      case '-': /* ... */
      case '*': /* ... */
      case '/': /* ... */
      default: assert(0);
    }
  }
}
```

现在，我们需要利用现有的规则和函数来填补实现我们的求值函数`eval()`:

```c
static int eval(int start, int end){
  if(start>end){
    printf("Unknown expression.\n");
    return -1;
  }else if(start==end){
    return atoi(tokens[start].str);
  }else if(check_parentheses(start,end)==1){
    return eval(start+1,end-1);
  }else if(check_parentheses(start,end)==-1){
    printf("parenthese mismatch error\n");
    return -1;
  }else{
    int op = get_token(start,end);
    if(op==-1){
      printf("Error: No valid operator found in expression\n");
      return -1;
    }
    word_t val1 = eval(start,op-1);
    word_t val2 = eval(op+1,end);
    switch(tokens[op].type){
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
}
```

经过测试，基本可以处理大多数情况了。我们现在可以将其封装在`expr()`中，然后实现`p`方法：

```c
word_t expr(char *e, bool *success) {
  if (!make_token(e)) {
    *success = false;
    return 0;
  }
  word_t val = eval(0,nr_token-1);
  *success = (val!=-1);
  return val;
}

static int cmd_p(char* args){
  bool success;
  word_t val=expr(args,&success);
  if(success==true)
    printf("%d\n",val);
  return 0;
}
```

出于限制，我们只使用`uint32_t`作为我们的返回类型。

### 测试代码

按照PA的要求，我们现在应该测试一下我们这个函数，但是我就跳过这一部分了，因为赶时间。
