// // =============================================|| setelah dirender.com ||===============================================
// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);

// app.use(express.static('public'));
// io.on('connection', socket => {
//   socket.on('join-room', room => {
//     socket.join(room);
//     const clients = [...io.sockets.adapter.rooms.get(room) || []];
//     // kirim daftar user yang sudah ada ke user baru
//     socket.emit('all-users', clients.filter(id => id !== socket.id));
//     // beri tahu user lain ada user baru
//     socket.to(room).emit('user-connected', socket.id);
//     socket.on('signal', ({to, signal}) => {
//       io.to(to).emit('signal', {
//         from: socket.id,
//         signal
//       });
//     });
//     socket.on('disconnect', () => {
//       socket.to(room).emit('user-disconnected', socket.id);
//     });
//     // TAMBAHKAN KODE INI:
//     socket.on('update-focus', status => {
//       socket.to(room).emit('user-focus-changed', { id: socket.id, status: status });
//     });
//   });
// });
// const PORT = process.env.PORT || 3000;

// server.listen(PORT, () => {
//   console.log(`Running on port ${PORT}`);
// });
// =============================================|| setelah dirender.com ||===============================================
// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);

// app.use(express.static('public'));

// io.on('connection', socket => {
//   socket.on('join-room', room => {
//     socket.join(room);
//     const clients = [...io.sockets.adapter.rooms.get(room) || []];
    
//     // Kirim daftar user yang sudah ada ke user baru
//     socket.emit('all-users', clients.filter(id => id !== socket.id));
    
//     // Beri tahu user lain ada user baru
//     socket.to(room).emit('user-connected', socket.id);
    
//     socket.on('signal', ({to, signal}) => {
//       io.to(to).emit('signal', {
//         from: socket.id,
//         signal
//       });
//     });
    
//     socket.on('disconnect', () => {
//       socket.to(room).emit('user-disconnected', socket.id);
//     });
    
//     // Meneruskan data status DAN nama pengguna
//     socket.on('update-focus', data => {
//       socket.to(room).emit('user-focus-changed', { 
//         id: socket.id, 
//         status: data.status, 
//         name: data.name 
//       });
//     });

//     socket.on('start-share-screen', (data) => {
//     socket.to(data.room).emit('user-started-sharing', {
//         id: socket.id,
//         name: data.name
//       });
//     });

//   socket.on('stop-share-screen', (room) => {
//       socket.to(room).emit('user-stopped-sharing', socket.id);
//     });
//   });
// });

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//   console.log(`Running on port ${PORT}`);
// });

// =============================================|| chatgpt ||===============================================
// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);

// app.use(express.static('public'));

// io.on('connection', socket => {
//   socket.on('join-room', room => {
//     socket.join(room);
//     const clients = [...io.sockets.adapter.rooms.get(room) || []];
    
//     socket.emit('all-users', clients.filter(id => id !== socket.id));
//     socket.to(room).emit('user-connected', socket.id);

//     socket.on('signal', ({to, signal}) => {
//       io.to(to).emit('signal', {
//         from: socket.id,
//         signal
//       });
//     });

//     socket.on('disconnect', () => {
//       socket.to(room).emit('user-disconnected', socket.id);
//     });

//     socket.on('update-focus', data => {
//       socket.to(room).emit('user-focus-changed', { 
//         id: socket.id, 
//         status: data.status, 
//         name: data.name 
//       });
//     });
//     socket.on('request-status', () => {
//       socket.to(room).emit('request-status-from', socket.id);
//     });
//     // ✅ SCREEN SHARE EVENTS
//     socket.on('screen-share-start', () => {
//       socket.to(room).emit('screen-share-started', socket.id);
//     });

//     socket.on('screen-share-stop', () => {
//       socket.to(room).emit('screen-share-stopped', socket.id);
//     });
//   });
// });

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//   console.log(`Running on port ${PORT}`);
// });

// =============================================|| chatgpt ||===============================================
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static('public'));

// ✅ ICE Config dengan TURN server Metered.ca
app.get('/ice-config', (req, res) => {
  res.json({
    iceServers: [
      {
        urls: 'stun:stun.relay.metered.ca:80',
      },
      {
        urls: 'turn:global.relay.metered.ca:80',
        username: 'b7b561628253fd215c181d66',
        credential: 'KbQoLAgD9L32PWFd',
      },
      {
        urls: 'turn:global.relay.metered.ca:80?transport=tcp',
        username: 'b7b561628253fd215c181d66',
        credential: 'KbQoLAgD9L32PWFd',
      },
      {
        urls: 'turn:global.relay.metered.ca:443',
        username: 'b7b561628253fd215c181d66',
        credential: 'KbQoLAgD9L32PWFd',
      },
      {
        urls: 'turns:global.relay.metered.ca:443?transport=tcp',
        username: 'b7b561628253fd215c181d66',
        credential: 'KbQoLAgD9L32PWFd',
      },
    ]
  });
});

// =============================================
// SOCKET.IO
// =============================================
io.on('connection', socket => {
  let currentRoom = null;

  socket.on('join-room', room => {
    currentRoom = room;
    socket.join(room);

    const clients = [...(io.sockets.adapter.rooms.get(room) || [])];
    const others  = clients.filter(id => id !== socket.id);

    socket.emit('all-users', others);
    socket.to(room).emit('user-connected', socket.id);

    // ✅ FIX Detecting: kirim status terkini ke pendatang baru
    const statuses = [];
    others.forEach(id => {
      const s = io.sockets.sockets.get(id);
      if (s?.lastStatus) {
        statuses.push({ id, ...s.lastStatus });
      }
    });
    if (statuses.length > 0) {
      socket.emit('current-statuses', statuses);
    }
  });

  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', { from: socket.id, signal });
  });

  socket.on('update-focus', data => {
    socket.lastStatus = { status: data.status, name: data.name };
    if (currentRoom) {
      socket.to(currentRoom).emit('user-focus-changed', {
        id:     socket.id,
        status: data.status,
        name:   data.name
      });
    }
  });

  socket.on('screen-share-start', () => {
    if (currentRoom) socket.to(currentRoom).emit('screen-share-started', socket.id);
  });

  socket.on('screen-share-stop', () => {
    if (currentRoom) socket.to(currentRoom).emit('screen-share-stopped', socket.id);
  });

  socket.on('disconnect', () => {
    if (currentRoom) socket.to(currentRoom).emit('user-disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Running on port ${PORT}`));