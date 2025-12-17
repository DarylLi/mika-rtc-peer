# Mika WebRTC 信令服务器

一个基于 Node.js 的 WebRTC 信令服务器，用于建立和管理 WebRTC 对等连接。



### 安装依赖

```bash
npm install
```

### 配置

#### SSL 证书

服务器需要 SSL 证书来支持 HTTPS/WSS 连接。请将证书文件放置在以下位置：

- 私钥：`./alikey/your.key`
- 公钥证书：`./alikey/your_public.crt`

#### 允许的域名

在 `server.js` 中配置允许访问的域名白名单：

```javascript
const ALLOWED_ORIGINS = [
  'https://darylli.github.io',
  'https://daryl.cn:1999',
];
```

### 运行服务器

```bash
npm start
```

默认端口为 3000，可以通过环境变量修改：

```bash
PORT=8080 npm start
```

## API 文档

### 消息类型

服务器支持以下消息类型：

| 消息类型 | 描述 |
|---------|------|
| `call` | 发布 WebRTC Offer |
| `join` | 加入房间 |
| `offer` | 转发 WebRTC Offer |
| `answer` | 转发 WebRTC Answer |
| `ice-candidate` | 转发 ICE Candidate |
| `leave` | 离开房间 |
| `error` | 错误消息 |

### 消息格式

所有消息都使用 JSON 格式，包含 `type` 和 `data` 字段：

```json
{
  "type": "消息类型",
  "data": { /* 消息数据 */ }
}
```

### 详细说明

#### 1. 连接服务器

```javascript
const ws = new WebSocket('wss://your-domain.com:3000');
```

#### 2. 加入房间

**请求：**
```json
{
  "type": "join",
  "data": {
    "clientId": "可选的客户端ID",
    "roomId": "房间ID"
  }
}
```

**响应：**
```json
{
  "type": "join",
  "data": {
    "success": true,
    "clientId": "客户端ID",
    "roomId": "房间ID",
    "message": "已加入房间"
  }
}
```

#### 3. 发布 Offer

**请求：**
```json
{
  "type": "call",
  "data": {
    "sdp": "WebRTC Offer SDP",
    "uid": "用户ID"
  }
}
```

**响应：**
服务器会广播更新后的发布列表到所有连接的客户端。

#### 4. 发送 Offer

**请求：**
```json
{
  "type": "offer",
  "data": {
    "sdp": "WebRTC Offer SDP",
    "type": "offer"
  }
}
```

#### 5. 发送 Answer

**请求：**
```json
{
  "type": "answer",
  "data": {
    "sdp": "WebRTC Answer SDP",
    "type": "answer"
  }
}
```

#### 6. 发送 ICE Candidate

**请求：**
```json
{
  "type": "ice-candidate",
  "data": {
    "candidate": "ICE Candidate 数据"
  }
}
```

#### 7. 离开房间

**请求：**
```json
{
  "type": "leave",
  "data": {}
}
```

## 环境变量

| 变量名 | 描述 | 默认值 |
|-------|------|-------|
| `PORT` | 服务器监听端口 | 3000 |

## 项目结构

```
.
├── alikey/                # SSL 证书目录
│   ├── franxxdaryl.site.key              # 私钥
│   └── franxxdaryl.site_public.crt        # 公钥证书
├── server.js             # 主服务器文件
├── package.json          # 项目配置
└── README.md             # 项目文档
```

## 注意事项

1. **SSL 证书**：服务器需要有效的 SSL 证书才能正常工作
2. **跨域限制**：请确保客户端域名在允许的域名列表中
3. **房间机制**：客户端必须先加入房间才能发送 Offer/Answer 消息
4. **连接管理**：服务器会自动清理断开的连接，无需手动管理

## 开发与调试

查看服务器日志：
```bash
npm start
```

## 作者

daryl
