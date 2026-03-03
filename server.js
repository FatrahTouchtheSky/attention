// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');


// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);


// app.use(express.static('public'));


// io.on('connection', socket => {
// socket.on('join-room', roomId => {
// socket.join(roomId);
// socket.to(roomId).emit('user-connected', socket.id);


// socket.on('signal', data => {
// socket.to(roomId).emit('signal', data);
// });


// socket.on('disconnect', () => {
// socket.to(roomId).emit('user-disconnected', socket.id);
// });
// });
// });


// server.listen(3000, () => console.log('Server running on http://localhost:3000'));


//============================================|| sebelum dirender.com ||===============================================



// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');


// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);


// app.use(express.static('public'));


// io.on('connection', socket => {
// socket.on('join-room', room => {
// socket.join(room);
// socket.to(room).emit('user-connected', socket.id);


// socket.on('signal', data => {
// socket.to(room).emit('signal', {from: socket.id, signal: data});
// });


// socket.on('disconnect', () => {
// socket.to(room).emit('user-disconnected', socket.id);
// });
// });
// });


// server.listen(3000, ()=>console.log('Running on http://localhost:3000'));

// =============================================|| setelah dirender.com ||===============================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', socket => {
  socket.on('join-room', room => {
    socket.join(room);
    socket.to(room).emit('user-connected', socket.id);

    socket.on('signal', data => {
      socket.to(room).emit('signal', { from: socket.id, signal: data });
    });

    socket.on('disconnect', () => {
      socket.to(room).emit('user-disconnected', socket.id);
    });
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Running on port ${PORT}`);
});