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
// const express = require('express');
// const http    = require('http');
// const { Server } = require('socket.io');

// const app    = express();
// const server = http.createServer(app);
// const io     = new Server(server);

// app.use(express.static('public'));

// // ✅ ICE Config dengan TURN server Metered.ca
// app.get('/ice-config', (req, res) => {
//   res.json({
//     iceServers: [
//       {
//         urls: 'stun:stun.relay.metered.ca:80',
//       },
//       {
//         urls: 'turn:global.relay.metered.ca:80',
//         username: 'b7b561628253fd215c181d66',
//         credential: 'KbQoLAgD9L32PWFd',
//       },
//       {
//         urls: 'turn:global.relay.metered.ca:80?transport=tcp',
//         username: 'b7b561628253fd215c181d66',
//         credential: 'KbQoLAgD9L32PWFd',
//       },
//       {
//         urls: 'turn:global.relay.metered.ca:443',
//         username: 'b7b561628253fd215c181d66',
//         credential: 'KbQoLAgD9L32PWFd',
//       },
//       {
//         urls: 'turns:global.relay.metered.ca:443?transport=tcp',
//         username: 'b7b561628253fd215c181d66',
//         credential: 'KbQoLAgD9L32PWFd',
//       },
//     ]
//   });
// });

// // =============================================
// // SOCKET.IO
// // =============================================
// io.on('connection', socket => {
//   let currentRoom = null;

//   socket.on('join-room', room => {
//     currentRoom = room;
//     socket.join(room);

//     const clients = [...(io.sockets.adapter.rooms.get(room) || [])];
//     const others  = clients.filter(id => id !== socket.id);

//     socket.emit('all-users', others);
//     socket.to(room).emit('user-connected', socket.id);

//     // ✅ FIX Detecting: kirim status terkini ke pendatang baru
//     const statuses = [];
//     others.forEach(id => {
//       const s = io.sockets.sockets.get(id);
//       if (s?.lastStatus) {
//         statuses.push({ id, ...s.lastStatus });
//       }
//     });
//     if (statuses.length > 0) {
//       socket.emit('current-statuses', statuses);
//     }
//   });

//   socket.on('signal', ({ to, signal }) => {
//     io.to(to).emit('signal', { from: socket.id, signal });
//   });

//   socket.on('update-focus', data => {
//     socket.lastStatus = { status: data.status, name: data.name };
//     if (currentRoom) {
//       socket.to(currentRoom).emit('user-focus-changed', {
//         id:     socket.id,
//         status: data.status,
//         name:   data.name
//       });
//     }
//   });

//   socket.on('screen-share-start', () => {
//     if (currentRoom) socket.to(currentRoom).emit('screen-share-started', socket.id);
//   });

//   socket.on('screen-share-stop', () => {
//     if (currentRoom) socket.to(currentRoom).emit('screen-share-stopped', socket.id);
//   });

//   socket.on('disconnect', () => {
//     if (currentRoom) socket.to(currentRoom).emit('user-disconnected', socket.id);
//   });
// });

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => console.log(`Running on port ${PORT}`));

// =============================================|| chatgpt ||===============================================
require('dotenv').config();
if (!process.env.TURN_USERNAME || !process.env.TURN_CREDENTIAL) {
  console.warn("\x1b[33m%s\x1b[0m", "⚠️ WARNING: TURN_USERNAME atau TURN_CREDENTIAL tidak ditemukan di .env!");
  console.warn("\x1b[33m%s\x1b[0m", "⚠️ Hal ini dapat menyebabkan kegagalan koneksi WebRTC (layar hitam) untuk pengguna di jaringan seluler (4G/5G) atau di belakang NAT ketat.");
}
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const os      = require('os');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  pingTimeout: 10000,
  pingInterval: 5000
});

app.use(express.static('public'));

// ✅ ICE Config dengan TURN server Metered.ca
app.get('/ice-config', (req, res) => {
  res.json({
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
      {
        urls: 'stun:stun.relay.metered.ca:80',
      },
      {
        urls: 'turn:global.relay.metered.ca:80',
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      },
      {
        urls: 'turn:global.relay.metered.ca:80?transport=tcp',
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      },
      {
        urls: 'turn:global.relay.metered.ca:443',
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      },
      {
        urls: 'turns:global.relay.metered.ca:443?transport=tcp',
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      },
    ]
  });
});

// ✅ Cek apakah room sudah dibuat (ada partisipan)
app.get('/check-room', (req, res) => {
  const room = req.query.room;
  if (!room) {
    return res.json({ exists: false });
  }
  // Cek apakah room ada di dalam list adapter (berarti sudah ada yang join/create)
  const roomExists = io.sockets.adapter.rooms.has(room);
  res.json({ exists: roomExists });
});




// =============================================
// SOCKET.IO & TRACKING
// =============================================
const roomFocusStats = {};
const roomScreenShare = {}; // Tracks active screen share in each room: roomId -> sharingSocketId

// --- SERVER SYSTEM MONITORING (CPU & RAM) ---
let serverCpuUsage = 0;
let lastCpuInfo = getCPUInfo();

// Periodically update server CPU usage
setInterval(() => {
  const currentCpuInfo = getCPUInfo();
  const idleDiff = currentCpuInfo.idle - lastCpuInfo.idle;
  const totalDiff = currentCpuInfo.total - lastCpuInfo.total;
  serverCpuUsage = totalDiff > 0 ? 100 - Math.round((100 * idleDiff) / totalDiff) : 0;
  lastCpuInfo = currentCpuInfo;
}, 1000);

function getCPUInfo() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  if (!cpus) return { idle: 0, total: 1 };
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }
  return { idle, total };
}

function getServerRamUsage() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  return Math.round(usedMem / 1024 / 1024);
}

app.get('/room-summary', (req, res) => {
  const room = req.query.room;
  if (!room || !roomFocusStats[room]) {
    return res.json({ success: false, data: null });
  }
  
  const now = Date.now();
  const summaryData = {};
  for (const socketId in roomFocusStats[room]) {
    const stats = roomFocusStats[room][socketId];
    const elapsed = now - stats.lastUpdateTime;
    
    let finalFocusedTime = stats.focusedTime;
    let finalTotalTime = stats.totalTime + elapsed;
    
    if (stats.lastStatus === 'Memperhatikan') {
      finalFocusedTime += elapsed;
    }
    
    // Ensure focused time never exceeds total time
    finalFocusedTime = Math.min(finalTotalTime, finalFocusedTime);

    summaryData[socketId] = {
      name: stats.name,
      total: finalTotalTime,
      focused: finalFocusedTime,
      lastStatus: stats.lastStatus || 'Detecting...'
    };
  }

  res.json({ success: true, data: summaryData });
});

// ✅ Route untuk clean URL room (misal: /abc-defg-hij atau /raqmiz)
app.get('/:room', (req, res, next) => {
  const room = req.params.room;
  // Jika path mengandung titik (seperti style.css, meeting.js), biarkan static middleware yang menangani
  if (room.includes('.')) {
    return next();
  }
  res.sendFile(__dirname + '/public/meeting.html');
});

io.on('connection', socket => {
  let currentRoom = null;

  socket.on('ping-rtt', (callback) => {
    if (typeof callback === 'function') {
      callback({
        cpu: serverCpuUsage,
        ram: getServerRamUsage()
      });
    }
  });

  socket.on('join-room', roomData => {
    let room;
    let name = null;
    let role = 'participant';
    let uId = null;

    if (roomData && typeof roomData === 'object') {
      room = roomData.room;
      name = roomData.name;
      role = roomData.role;
      uId = roomData.userId;
    } else {
      room = roomData;
    }

    currentRoom = room;

    // Bersihkan lingering socket lama milik userId yang sama sebelum join
    if (room && uId) {
      socket.userId = uId;
      if (name) socket.userName = name;
      socket.userRole = role;

      const clientsInRoom = io.sockets.adapter.rooms.get(room);
      if (clientsInRoom) {
        const clientsArray = [...clientsInRoom];
        clientsArray.forEach(id => {
          if (id !== socket.id) {
            const existingSocket = io.sockets.sockets.get(id);
            if (existingSocket && existingSocket.userId === uId) {
              console.log(`[duplicate cleanup] Memutus socket lama ${id} untuk user ${uId}`);
              existingSocket.leave(room);
              existingSocket.disconnect(true);
              socket.to(room).emit('user-disconnected', id);
            }
          }
        });
      }
    }

    socket.join(room);

    const clients = [...(io.sockets.adapter.rooms.get(room) || [])];
    const others  = clients.filter(id => id !== socket.id);

    socket.emit('all-users', others);
    socket.to(room).emit('user-connected', socket.id);

    // Kirim status screen share aktif jika ada
    const currentSharer = roomScreenShare[room];
    if (currentSharer) {
      socket.emit('screen-share-started', currentSharer);
    }

    // Kirim nama dan role semua user yang sudah ada ke pendatang baru
    const names = [];
    others.forEach(id => {
      const s = io.sockets.sockets.get(id);
      if (s?.userName) names.push({ id, name: s.userName, role: s.userRole });
    });
    if (names.length > 0) socket.emit('peer-names', names);

    // Kirim status fokus terkini ke pendatang baru
    const statuses = [];
    others.forEach(id => {
      const s = io.sockets.sockets.get(id);
      if (s?.lastStatus) statuses.push({ id, ...s.lastStatus });
    });
    if (statuses.length > 0) socket.emit('current-statuses', statuses);

    // Kirim status mic/cam terkini ke pendatang baru
    const mediaStatuses = [];
    others.forEach(id => {
      const s = io.sockets.sockets.get(id);
      if (s?.mediaStatus) mediaStatuses.push({ id, ...s.mediaStatus });
    });
    if (mediaStatuses.length > 0) socket.emit('current-media-statuses', mediaStatuses);
  });

  socket.on('set-name', data => {
    socket.userName = data.name;
    socket.userRole = data.role || 'participant';
    socket.userId = data.userId;
    if (currentRoom) {
      // Jika userId sudah memiliki data focus statistik sebelumnya,
      // perbarui lastUpdateTime agar reload gap tidak merusak totalTime.
      if (roomFocusStats[currentRoom] && roomFocusStats[currentRoom][data.userId]) {
        roomFocusStats[currentRoom][data.userId].lastUpdateTime = Date.now();
      }
      socket.to(currentRoom).emit('peer-name', { id: socket.id, name: data.name, role: socket.userRole });
    }
  });

  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', { from: socket.id, signal });
  });

  socket.on('recreate-peer', ({ to }) => {
    if (to) {
      io.to(to).emit('recreate-peer', { from: socket.id });
    }
  });

  socket.on('update-focus', data => {
    socket.lastStatus = { status: data.status, name: data.name };
    if (currentRoom) {
      // TRACKING LOGIC (Lightweight Time Counter)
      const userId = socket.userId || socket.id;
      const now = Date.now();
      if (!roomFocusStats[currentRoom]) {
        roomFocusStats[currentRoom] = {};
      }
      if (!roomFocusStats[currentRoom][userId]) {
        roomFocusStats[currentRoom][userId] = { 
          name: data.name, 
          focusedTime: 0, 
          totalTime: 0,
          lastStatus: data.status,
          lastUpdateTime: now
        };
      }
      const stats = roomFocusStats[currentRoom][userId];
      if (data.name) stats.name = data.name;
      
      const elapsed = now - stats.lastUpdateTime;
      stats.totalTime += elapsed;
      if (stats.lastStatus === 'Memperhatikan') {
        stats.focusedTime += elapsed;
      }
      
      stats.lastStatus = data.status;
      stats.lastUpdateTime = now;

      socket.to(currentRoom).emit('user-focus-changed', {
        id:     socket.id,
        status: data.status,
        name:   data.name
      });
    }
  });

  socket.on('media-status', data => {
    socket.mediaStatus = { mic: data.mic, cam: data.cam };
    if (currentRoom) {
      socket.to(currentRoom).emit('media-status-changed', {
        id: socket.id,
        mic: data.mic,
        cam: data.cam
      });
    }
  });

  socket.on('screen-share-start', () => {
    if (currentRoom) {
      roomScreenShare[currentRoom] = socket.id;
      socket.to(currentRoom).emit('screen-share-started', socket.id);
    }
  });

  socket.on('screen-share-stop', () => {
    if (currentRoom) {
      if (roomScreenShare[currentRoom] === socket.id) {
        delete roomScreenShare[currentRoom];
      }
      socket.to(currentRoom).emit('screen-share-stopped', socket.id);
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      socket.to(currentRoom).emit('user-disconnected', socket.id);
      
      // Hapus status screen share jika yang menshare disconnect
      if (roomScreenShare[currentRoom] === socket.id) {
        delete roomScreenShare[currentRoom];
      }

      // Bersihkan memory jika ruangan kosong
      const clients = io.sockets.adapter.rooms.get(currentRoom);
      if (!clients || clients.size === 0) {
        delete roomFocusStats[currentRoom];
        delete roomScreenShare[currentRoom];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Running on port ${PORT}`));