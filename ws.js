// ws.js
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { get, all, run } from './database.js';
import { CONFIG } from './config.js';

const MAX_MESSAGE_LENGTH = CONFIG.chat.maxMessageLength;
const MAX_HISTORY = CONFIG.chat.maxHistory;
const TYPING_TIMEOUT_MS = CONFIG.chat.typingTimeoutMs;

// ============================================================
//  ESTADO EN MEMORIA
// ============================================================

// Clientes conectados: Map<userId, { ws, name, username, id }>
const clients = new Map();

// Usuarios escribiendo: Map<userId, timeoutId>
const typingUsers = new Map();

// ============================================================
//  HELPERS
// ============================================================
function broadcast(data, excludeUserId = null) {
  const payload = JSON.stringify(data);
  for (const [userId, client] of clients.entries()) {
    if (excludeUserId && userId === excludeUserId) continue;
    if (client.ws.readyState === 1) {
      client.ws.send(payload);
    }
  }
}

function getOnlineUsers() {
  return Array.from(clients.values()).map(c => ({
    id: c.id,
    name: c.name,
    username: c.username
  }));
}

function broadcastOnlineUsers() {
  broadcast({
    type: 'online_users',
    users: getOnlineUsers(),
    count: clients.size
  });
}

function broadcastTyping() {
  broadcast({
    type: 'typing',
    users: Array.from(typingUsers.keys()).map(id => {
      const client = clients.get(id);
      return client ? client.name : null;
    }).filter(Boolean)
  });
}

// ============================================================
//  INICIALIZAR SERVIDOR WEBSOCKET
// ============================================================
export function initWebSocket(server) {
  const wss = new WebSocketServer({
    server,
    path: '/ws'
  });

  wss.on('connection', async (ws, req) => {
    // ============ AUTENTICACIÓN ============
    let token;
    try {
      const url = new URL(req.url, 'http://localhost');
      token = url.searchParams.get('token');
    } catch {
      ws.close(4001, 'URL inválida');
      return;
    }

    if (!token) {
      ws.close(4001, 'Token requerido');
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, CONFIG.jwt.secret);
    } catch {
      ws.close(4001, 'Token inválido');
      return;
    }

    const userId = decoded.id;

    // Si ya había una conexión de este usuario, la cerramos
    const existing = clients.get(userId);
    if (existing) {
      try { existing.ws.close(4002, 'Nueva conexión abierta'); } catch {}
      clients.delete(userId);
    }

    // ============ REGISTRAR CLIENTE ============
    const client = {
      ws,
      id: userId,
      name: decoded.name,
      username: decoded.username
    };
    clients.set(userId, client);

    console.log(`[+] ${decoded.name} conectado (${clients.size} online)`);

    // ============ ENVIAR HISTORIAL ============
    try {
      const history = await all(`
        SELECT m.id, m.content, m.created_at,
               u.id AS user_id, u.name AS user_name, u.username AS user_username
        FROM messages m
        JOIN users u ON u.id = m.user_id
        ORDER BY m.created_at DESC
        LIMIT $1
      `, [MAX_HISTORY]);

      ws.send(JSON.stringify({
        type: 'history',
        messages: history.reverse().map(m => ({
          id: m.id,
          content: m.content,
          createdAt: m.created_at,
          user: {
            id: m.user_id,
            name: m.user_name,
            username: m.user_username
          }
        }))
      }));
    } catch (err) {
      console.error('Error enviando historial:', err.message);
    }

    // ============ ENVIAR ESTADO INICIAL ============
    ws.send(JSON.stringify({
      type: 'welcome',
      user: { id: userId, name: decoded.name, username: decoded.username },
      onlineCount: clients.size
    }));

    // Notificar a todos
    broadcastOnlineUsers();

    // ============ MENSAJES DEL CLIENTE ============
    ws.on('message', async (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      // -------- TYPING --------
      if (data.type === 'typing') {
        if (!typingUsers.has(userId)) {
          typingUsers.set(userId, setTimeout(() => {
            typingUsers.delete(userId);
            broadcastTyping();
          }, TYPING_TIMEOUT_MS));
        } else {
          clearTimeout(typingUsers.get(userId));
          typingUsers.set(userId, setTimeout(() => {
            typingUsers.delete(userId);
            broadcastTyping();
          }, TYPING_TIMEOUT_MS));
        }
        broadcastTyping();
        return;
      }

      // -------- STOP TYPING --------
      if (data.type === 'stop_typing') {
        if (typingUsers.has(userId)) {
          clearTimeout(typingUsers.get(userId));
          typingUsers.delete(userId);
          broadcastTyping();
        }
        return;
      }

      // -------- MENSAJE --------
      if (data.type === 'message') {
        const content = String(data.content || '').trim();

        if (!content) return;
        if (content.length > MAX_MESSAGE_LENGTH) return;

        // Quitar typing
        if (typingUsers.has(userId)) {
          clearTimeout(typingUsers.get(userId));
          typingUsers.delete(userId);
          broadcastTyping();
        }

        try {
          const message = await get(`
            INSERT INTO messages (user_id, content)
            VALUES ($1, $2)
            RETURNING id, content, created_at
          `, [userId, content]);

          // Broadcast a todos (incluido el emisor)
          broadcast({
            type: 'message',
            message: {
              id: message.id,
              content: message.content,
              createdAt: message.created_at,
              user: {
                id: userId,
                name: client.name,
                username: client.username
              }
            }
          });
        } catch (err) {
          console.error('Error guardando mensaje:', err.message);
          ws.send(JSON.stringify({ type: 'error', message: 'Error al enviar mensaje' }));
        }
      }
    });

    // ============ DESCONEXIÓN ============
    ws.on('close', () => {
      clients.delete(userId);
      if (typingUsers.has(userId)) {
        clearTimeout(typingUsers.get(userId));
        typingUsers.delete(userId);
        broadcastTyping();
      }
      console.log(`[-] ${decoded.name} desconectado (${clients.size} online)`);
      broadcastOnlineUsers();
    });

    ws.on('error', (err) => {
      console.error('Error WebSocket:', err.message);
    });
  });

  return wss;
}
