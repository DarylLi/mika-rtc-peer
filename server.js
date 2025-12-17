const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const serverOptions = {
      key: fs.readFileSync(__dirname+'/alikey/franxxdaryl.site.key'),
      cert: fs.readFileSync(__dirname+'/alikey/franxxdaryl.site_public.crt')
    };
// 创建HTTP服务器
const server = https.createServer(serverOptions)

const ALLOWED_ORIGINS = [
  'https://darylli.github.io',
  'https://daryl.cn:1999',
];
// 创建WebSocket服务器
const wss = new WebSocket.Server({ 
  server,
  verifyClient: (info, done) => {
  const origin = info.req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    done(true);
  }  else {
      // 拒绝不在白名单中的源
      console.log(`❌ 拒绝来自 ${origin} 的连接`);
      done(false, 403, 'Origin not allowed');
    }
} });

// 存储所有连接的客户端
const clients = new Map();

// 消息类型
const MessageType = {
  CALL: 'call',
  JOIN: 'join',
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'ice-candidate',
  LEAVE: 'leave',
  ERROR: 'error'
};


const descriptionList = [];
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[${new Date().toISOString()}] 新客户端连接: ${clientIp}`);
  
  let clientId = null;
  let roomId = null;

  // 发送消息的辅助函数
  const sendMessage = (type, data) => {
    try {
      ws.send(JSON.stringify({ type, data }));
    } catch (err) {
      console.error('发送消息失败:', err);
    }
  };
  
  sendMessage('connect', { message: `${clientIp}链接成功~` });
  sendMessage('releaseList', { message: `当前已经发布的offer列表` ,data: descriptionList});
  clients.set(clientIp, { ws, clientId:clientIp });
  // 广播消息到房间内其他客户端
  const broadcastToRoom = (room, senderId, type, data) => {
    clients.forEach((client, id) => {
      if (client.roomId === room && id !== senderId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({ 
          type, 
          data: { ...data, from: senderId }
        }));
      }
    });
  };

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      console.log(`[${new Date().toISOString()}] 收到消息:`, msg.type);

      switch (msg.type) {
        // rtc端加入视频聊天后 收集相关description
        case MessageType.CALL:
          descriptionList.push({desc:msg.data.sdp,uid:msg.data.uid,ip:clientIp});
          // sendMessage('releaseList', { message: `当前已经发布的offer列表` ,data: descriptionList});
          console.log(clients)
          clients.forEach((client, id) => {
            console.log(client)
            client.ws.send(JSON.stringify({ 
              type:'releaseList', 
              data: { message: `当前已经发布的offer列表` ,data: descriptionList}
            }));
          });
          break;

        case MessageType.JOIN:
          // 客户端加入房间
          clientId = msg.data.clientId || generateId();
          roomId = msg.data.roomId;
          
          clients.set(clientId, { ws, roomId, clientId });
          
          sendMessage(MessageType.JOIN, { 
            success: true, 
            clientId,
            roomId,
            message: `已加入房间 ${roomId}`
          });
          
          // 通知房间内其他人
          broadcastToRoom(roomId, clientId, MessageType.JOIN, {
            clientId,
            message: `客户端 ${clientId} 加入了房间`
          });
          
          console.log(`客户端 ${clientId} 加入房间 ${roomId}`);
          break;

        case MessageType.OFFER:
          // 转发 WebRTC Offer
          if (!clientId || !roomId) {
            sendMessage(MessageType.ERROR, { message: '请先加入房间' });
            return;
          }
          
          console.log(`转发 Offer 从 ${clientId} 到房间 ${roomId}`);
          console.log('Offer SDP:', msg.data.sdp?.substring(0, 100) + '...');
          
          broadcastToRoom(roomId, clientId, MessageType.OFFER, {
            sdp: msg.data.sdp,
            type: msg.data.type
          });
          break;

        case MessageType.ANSWER:
          // 转发 WebRTC Answer
          if (!clientId || !roomId) {
            sendMessage(MessageType.ERROR, { message: '请先加入房间' });
            return;
          }
          
          console.log(`转发 Answer 从 ${clientId} 到房间 ${roomId}`);
          console.log('Answer SDP:', msg.data.sdp?.substring(0, 100) + '...');
          
          broadcastToRoom(roomId, clientId, MessageType.ANSWER, {
            sdp: msg.data.sdp,
            type: msg.data.type
          });
          break;

        case MessageType.ICE_CANDIDATE:
          // 转发 ICE Candidate
          if (!clientId || !roomId) {
            sendMessage(MessageType.ERROR, { message: '请先加入房间' });
            return;
          }
          
          console.log(`转发 ICE Candidate 从 ${clientId}`);
          
          broadcastToRoom(roomId, clientId, MessageType.ICE_CANDIDATE, {
            candidate: msg.data.candidate
          });
          break;

        case MessageType.LEAVE:
          // 客户端离开房间
          handleClientLeave();
          break;

        default:
          sendMessage(MessageType.ERROR, { message: '未知的消息类型' });
      }
    } catch (err) {
      console.error('处理消息错误:', err);
      sendMessage(MessageType.ERROR, { message: '消息格式错误' });
    }
  });

  // 处理客户端离开
  const handleClientLeave = () => {
    if (clientId && roomId) { 
      console.log(`客户端 ${clientId} 离开房间 ${roomId}`);
      descriptionList = descriptionList.filter(e=> e.ip !== clientIp)
      broadcastToRoom(roomId, clientId, MessageType.LEAVE, {
        clientId,
        message: `客户端 ${clientId} 离开了房间`
      });
      
      clients.delete(clientId);
      clientId = null;
      roomId = null;
    }
  };

  ws.on('close', () => {
    console.log(`[${new Date().toISOString()}] 客户端断开连接`);
    handleClientLeave();
  });

  ws.on('error', (err) => {
    console.error('WebSocket错误:', err);
    handleClientLeave();
  });
});

// 生成唯一ID
function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebRTC信令服务器运行在端口 ${PORT}`);
  console.log(`WebSocket地址: wss://localhost:${PORT}`);
});

// 定期清理断开的连接
setInterval(() => {
  clients.forEach((client, id) => {
    if (client.ws.readyState === WebSocket.CLOSED) {
      console.log(`清理断开的客户端: ${id}`);
      clients.delete(id);
    }
  });
}, 30000);