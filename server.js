const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors()); 

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ==========================================
// 🧠 GLOBAL MEMORY (Optimized for Crores of users)
// ==========================================
// User ke array banayenge taaki 2 tabs khule ho tab bhi online dikhe
let connectedUsers = {}; // Format: { "userId_1": ["socketId_A", "socketId_B"] }
let waitingStranger = null; // Sirf object save karenge memory bachane ke liye

io.on('connection', (socket) => {
  console.log('🟢 Naya User Connect Hua! ID:', socket.id);

  // ==========================================
  // 🟢 1. LIVE ONLINE / OFFLINE SYSTEM (WhatsApp Style)
  // ==========================================
  socket.on('user_connected', (userId) => {
    socket.userId = userId;
    
    // Agar user pehli baar connect ho raha hai, toh array banao
    if (!connectedUsers[userId]) {
      connectedUsers[userId] =[];
      // Sirf tabhi Online status bhejo jab pehla tab khule
      io.emit('online_status_update', { userId: userId, status: 'online' });
    }
    
    // Socket ID ko user ke account me daal do (Multi-tab support)
    connectedUsers[userId].push(socket.id);
    console.log(`User ID ${userId} is Live! (Tabs open: ${connectedUsers[userId].length})`);
  });
  // 🟢 NAYA CODE: Check karo ki dost pehle se online toh nahi hai?
  socket.on('check_user_status', (friendId) => {
    // Agar dost online hai kisi bhi tab me
    if (connectedUsers[friendId] && connectedUsers[friendId].length > 0) {
      socket.emit('online_status_update', { userId: friendId, status: 'online' });
    }
  });


  // ==========================================
  // 🤝 2. FRIEND CHAT SYSTEM (Real-time)
  // ==========================================
  socket.on('send_friend_message', (data) => {
    let receiverSockets = connectedUsers[data.receiver_id];
    
    // Agar dost online hai (kisi bhi tab me)
    if (receiverSockets && receiverSockets.length > 0) {
      receiverSockets.forEach(socketId => {
        io.to(socketId).emit('receive_friend_message', data);
      });
    }
  });

  socket.on('friend_typing', (data) => {
    let receiverSockets = connectedUsers[data.receiver_id];
    if (receiverSockets) receiverSockets.forEach(sId => io.to(sId).emit('friend_is_typing', { sender_id: data.sender_id }));
  });

  socket.on('friend_stop_typing', (data) => {
    let receiverSockets = connectedUsers[data.receiver_id];
    if (receiverSockets) receiverSockets.forEach(sId => io.to(sId).emit('friend_stopped_typing', { sender_id: data.sender_id }));
  });


  // ==========================================
  // 🎭 3. RANDOM CHAT SYSTEM (Super Smooth)
  // ==========================================
  socket.on('find_stranger', () => {
    
    if (waitingStranger && waitingStranger.socket.id !== socket.id) {
      // 🤝 Match Found!
      let roomName = 'room_' + socket.id + '_' + waitingStranger.socket.id;
      
      socket.join(roomName);
      waitingStranger.socket.join(roomName);
      
      socket.strangerRoom = roomName;
      waitingStranger.socket.strangerRoom = roomName;
      
      io.to(roomName).emit('stranger_matched', { status: 'success', message: 'Stranger connected! Say Hi 👋' });
      
      console.log(`Match done in room: ${roomName}`);
      waitingStranger = null; // Waiting list khali
    } 
    else {
      // ⏳ Waiting me dalo (Optimized: Pura socket assign karne ki jagah object banaya)
      waitingStranger = { socket: socket };
      socket.emit('waiting_for_stranger', { status: 'waiting', message: 'Looking for a stranger...' });
      console.log(`Socket ${socket.id} is waiting.`);
    }
  });

  socket.on('send_stranger_message', (messageText) => {
    if (socket.strangerRoom) socket.to(socket.strangerRoom).emit('receive_stranger_message', messageText);
  });

  socket.on('stranger_typing', () => {
    if (socket.strangerRoom) socket.to(socket.strangerRoom).emit('stranger_is_typing');
  });

  socket.on('stranger_stop_typing', () => {
    if (socket.strangerRoom) socket.to(socket.strangerRoom).emit('stranger_stopped_typing');
  });

  // 🏃‍♂️ JAB KOI "NEXT" DABAYE (Ab Samne wala bhi handle hoga!)
  socket.on('skip_stranger', () => {
    if (socket.strangerRoom) {
      // Samne wale ko batao ki bhai tumhara partner bhaag gaya
      socket.to(socket.strangerRoom).emit('stranger_disconnected', { message: 'Stranger skipped! Finding next...' });
      
      // Samne wale ka room variable bhi clear kar do (bohot zaroori!)
      let roomClients = io.sockets.adapter.rooms.get(socket.strangerRoom);
      if (roomClients) {
        for (const clientId of roomClients) {
          let clientSocket = io.sockets.sockets.get(clientId);
          if (clientSocket) clientSocket.strangerRoom = null;
        }
      }

      socket.leave(socket.strangerRoom);
      socket.strangerRoom = null;
      
      // Khud ko wapas find pe bhej do automatically (Optional)
      // socket.emit('auto_find_new'); 
    }
  });


  // ==========================================
  // 🛑 4. DISCONNECT LOGIC (Net Off / Tab Close)
  // ==========================================
  socket.on('disconnect', () => {
    console.log('🔴 User Chala Gaya ID:', socket.id);

    // 1. Friend Chat Cleanup
    if (socket.userId && connectedUsers[socket.userId]) {
      // Us particular tab ki ID hatao
      connectedUsers[socket.userId] = connectedUsers[socket.userId].filter(id => id !== socket.id);
      
      // Agar saare tab band ho gaye (Array length 0), tabhi usko totally offline dikhao
      if (connectedUsers[socket.userId].length === 0) {
        delete connectedUsers[socket.userId];
        io.emit('online_status_update', { userId: socket.userId, status: 'offline' });
      }
    }

    // 2. Random Chat Cleanup
    if (waitingStranger && waitingStranger.socket.id === socket.id) {
      waitingStranger = null; // Waiting list se hatao
    }
    
    if (socket.strangerRoom) {
      socket.to(socket.strangerRoom).emit('stranger_disconnected', { message: 'Stranger left unexpectedly due to network loss.' });
      
      // Bacha hua partner akele reh gaya usko room se azaad karo
      let roomClients = io.sockets.adapter.rooms.get(socket.strangerRoom);
      if (roomClients) {
        for (const clientId of roomClients) {
          let clientSocket = io.sockets.sockets.get(clientId);
          if (clientSocket) clientSocket.strangerRoom = null;
        }
      }
    }
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🔥 VELETIFY ENGINE RUNNING ON PORT ${PORT} 🔥`);
});
