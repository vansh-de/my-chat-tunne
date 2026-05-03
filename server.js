const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors()); 

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods:["GET", "POST"] }
});

// ==========================================
// 🧠 SUPER OPTIMIZED GLOBAL MEMORY 
// ==========================================
const connectedUsers = new Map(); // Map is faster than Object for dynamic keys
const waitingQueue = new Set();   // O(1) Time Complexity

io.on('connection', (socket) => {
  console.log('🟢 Naya User Connect Hua! ID:', socket.id);

  // ==========================================
  // 🤝 1. FRIEND CHAT SYSTEM
  // ==========================================
  socket.on('user_connected', (userId) => {
    socket.userId = userId;
    
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set()); 
      io.emit('online_status_update', { userId: userId, status: 'online' });
    }
    connectedUsers.get(userId).add(socket.id);
  });

  socket.on('check_user_status', (friendId) => {
    if (connectedUsers.has(friendId) && connectedUsers.get(friendId).size > 0) {
      socket.emit('online_status_update', { userId: friendId, status: 'online' });
    }
  });

  socket.on('send_friend_message', (data) => {
    let receiverSockets = connectedUsers.get(data.receiver_id);
    if (receiverSockets) {
      receiverSockets.forEach(socketId => {
        io.to(socketId).emit('receive_friend_message', data);
      });
    }
  });

  // ==========================================
  // 🎭 2. RANDOM CHAT SYSTEM (Ultra Fast)
  // ==========================================
  socket.on('find_stranger', () => {
    // 1. Agar pehle se room mein hai, toh bahar nikalo (RAM bachao)
    if (socket.strangerRoom) {
        socket.leave(socket.strangerRoom);
        socket.strangerRoom = null;
    }

    // 2. Agar user pehle se line mein hai, toh wapas add mat karo (Spam protection)
    if (waitingQueue.has(socket.id)) return;

    let partnerId = null;
    let partnerSocket = null;

    // 🔥 FASTEST WAY TO GET FIRST PERSON FROM QUEUE (O(1) Logic)
    for (let id of waitingQueue) {
      let tempSocket = io.sockets.sockets.get(id);
      
      if (tempSocket && id !== socket.id) {
        partnerId = id;
        partnerSocket = tempSocket;
        break; // Jaise hi pehla zinda banda mila, loop tod do!
      } else {
        // Agar socket dead hai, toh kachra saaf karo
        waitingQueue.delete(id);
      }
    }

    if (partnerSocket) {
      // 🤝 MATCH FOUND! Dono ko line se hatao
      waitingQueue.delete(partnerId);
      waitingQueue.delete(socket.id);

      // Room banao (Unique ID)
      let roomName = 'room_' + Date.now() + '_' + socket.id; 
      
      socket.join(roomName);
      partnerSocket.join(roomName);
      
      socket.strangerRoom = roomName;
      partnerSocket.strangerRoom = roomName;
      
      // Dono ko batao ki match ho gaya
      io.to(roomName).emit('stranger_matched', { status: 'success', message: 'Stranger connected! Say Hi 👋' });
      console.log(`✅ Match done: ${roomName}`);
    } 
    else {
      // ⏳ Koi nahi mila, toh line mein lag jao
      waitingQueue.add(socket.id);
      socket.emit('waiting_for_stranger', { status: 'waiting', message: 'Looking for a stranger...' });
    }
  });

  socket.on('send_stranger_message', (messageText) => {
    if (socket.strangerRoom) {
        socket.to(socket.strangerRoom).emit('receive_stranger_message', messageText);
    }
  });

  socket.on('stranger_typing', () => {
    if (socket.strangerRoom) socket.to(socket.strangerRoom).emit('stranger_is_typing');
  });

  socket.on('stranger_stop_typing', () => {
    if (socket.strangerRoom) socket.to(socket.strangerRoom).emit('stranger_stopped_typing');
  });

  // ==========================================
  // 🏃‍♂️ 3. SKIP / LEAVE LOGIC (Next Button)
  // ==========================================
  socket.on('skip_stranger', () => {
    if (socket.strangerRoom) {
      let currentRoom = socket.strangerRoom;

      // 1. Partner ko batao ki ye chala gaya
      socket.to(currentRoom).emit('stranger_disconnected', { message: 'Stranger skipped! Finding next...' });
      
      // 2. Partner ka variable clear karo taaki wo naya match dhundh sake
      let roomClients = io.sockets.adapter.rooms.get(currentRoom);
      if(roomClients){
         roomClients.forEach(clientId => {
            let clientSocket = io.sockets.sockets.get(clientId);
            if(clientSocket) clientSocket.strangerRoom = null; 
         });
      }

      // 3. Room ko RAM se hamesha ke liye uda do
      io.socketsLeave(currentRoom); 
      
    } else {
      // Agar line me laga tha aur next daba diya, toh line se hatao
      waitingQueue.delete(socket.id);
    }
  });

  // ==========================================
  // 🛑 4. DISCONNECT LOGIC (Net Off / Tab Close)
  // ==========================================
  socket.on('disconnect', () => {
    console.log('🔴 User Chala Gaya ID:', socket.id);

    // 1. Friend Chat Cleanup
    if (socket.userId && connectedUsers.has(socket.userId)) {
      let userSockets = connectedUsers.get(socket.userId);
      userSockets.delete(socket.id);
      
      if (userSockets.size === 0) {
        connectedUsers.delete(socket.userId);
        io.emit('online_status_update', { userId: socket.userId, status: 'offline' });
      }
    }

    // 2. Random Chat Cleanup (Queue se hatao)
    waitingQueue.delete(socket.id);
    
    // 3. Agar room me tha aur net chala gaya
    if (socket.strangerRoom) {
      let currentRoom = socket.strangerRoom;
      
      // Partner ko message bhejo
      socket.to(currentRoom).emit('stranger_disconnected', { message: 'Stranger left unexpectedly.' });
      
      // Partner ka variable clear karo
      let roomClients = io.sockets.adapter.rooms.get(currentRoom);
      if(roomClients){
         roomClients.forEach(clientId => {
            let clientSocket = io.sockets.sockets.get(clientId);
            if(clientSocket && clientSocket.id !== socket.id) {
                clientSocket.strangerRoom = null;
            }
         });
      }

      // Room delete karo RAM se
      io.socketsLeave(currentRoom);
    }
  });

}); 

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🔥 VELETIFY ENGINE RUNNING ON PORT ${PORT} 🔥`);
});
