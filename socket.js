const WebSocket = require('ws');

class SocketServer {
  static instance;

  constructor(server) {
    this.wss = null;
    this.clients = {};
    this.createSocketServer(server);
  }

  static getInstance(server = null) {
    if (SocketServer.instance) {
      return SocketServer.instance;
    }
    SocketServer.instance = new SocketServer(server);
    return SocketServer.instance;
  }

  createSocketServer(server) {
    this.wss = new WebSocket.Server({ server });
    this.runSocketServer();
  }

  runSocketServer() {
    console.log('Socket Server is running...');
    this.wss.on('connection', (ws) => {
      ws.on('message', (message) => {
        message = JSON.parse(message.toString('utf8'));
        switch (message.type) {
          case 'token':
            this.clients[message.content] = ws;
            break;
        }
      });
    });
  }

  sendMsg2Client(accessToken, type, data) {
    this.clients[accessToken]?.send(JSON.stringify({ type, data }));
  }
}

module.exports = SocketServer;