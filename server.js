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
// 🧠 SUPER OPTIMIZED GLOBAL MEMORY 
// ==========================================
let connectedUsers = {}; 
let waitingQueue = new Set(); // O(1) Time Complexity - Fastest for Millions

io.on('connection', (socket) => {
  console.log('🟢 Naya User Connect Hua! ID:', socket.id);

  // ==========================================
  // 🟢 1. LIVE ONLINE / OFFLINE SYSTEM (Friend Chat)
  // ==========================================
  socket.on('user_connected', (userId) => {
    socket.userId = userId;
    
    if (!connectedUsers[userId]) {
      connectedUsers[userId] = new Set(); 
      io.emit('online_status_update', { userId: userId, status: 'online' });
    }
    
    connectedUsers[userId].add(socket.id);
  });

  socket.on('check_user_status', (friendId) => {
    if (connectedUsers[friendId] && connectedUsers[friendId].size > 0) {
      socket.emit('online_status_update', { userId: friendId, status: 'online' });
    }
  });

  // ==========================================
  // 🤝 2. FRIEND CHAT SYSTEM
  // ==========================================
  socket.on('send_friend_message', (data) => {
    let receiverSockets = connectedUsers[data.receiver_id];
    if (receiverSockets && receiverSockets.size > 0) {
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
  // 🎭 3. RANDOM CHAT SYSTEM (Super Smooth & Fast)
  // ==========================================
  socket.on('find_stranger', () => {
    // Agar user pehle se kisi room me hai, toh pehle usko waha se nikalo
    if (socket.strangerRoom) {
        socket.leave(socket.strangerRoom);
        socket.strangerRoom = null;
    }

    let partnerSocket = null;
    let partnerId = null;

    // 🔥 Queue (Line) se zinda partner dhundho
    for (let id of waitingQueue) {
      let tempSocket = io.sockets.sockets.get(id);
      
      // Check karo ki socket zinda hai aur khud se connect nahi ho raha
      if (tempSocket && id !== socket.id) {
        partnerId = id;
        partnerSocket = tempSocket;
        break; 
      } else if (!tempSocket) {
        // Dead socket ko line se hatao (RAM bachao)
        waitingQueue.delete(id);
      }
    }

    if (partnerSocket) {
      // 🤝 Match Found! Dono ko line se bahar nikalo
      waitingQueue.delete(partnerId);
      waitingQueue.delete(socket.id);

      // Room banao
      let roomName = 'room_' + socket.id + '_' + partnerSocket.id;
      
      socket.join(roomName);
      partnerSocket.join(roomName);
      
      socket.strangerRoom = roomName;
      partnerSocket.strangerRoom = roomName;
      
      io.to(roomName).emit('stranger_matched', { status: 'success', message: 'Stranger connected! Say Hi 👋' });
      console.log(`✅ Match done: ${roomName}`);
    } 
    else {
      // ⏳ Line me lago
      waitingQueue.add(socket.id);
      socket.emit('waiting_for_stranger', { status: 'waiting', message: 'Looking for a stranger...' });
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

  // 🏃‍♂️ JAB KOI "NEXT" YA "LEAVE" DABAYE 
  socket.on('skip_stranger', () => {
    if (socket.strangerRoom) {
      let currentRoom = socket.strangerRoom;

      // 1. Partner ko batao ki ye chala gaya
      socket.to(currentRoom).emit('stranger_disconnected', { message: 'Stranger skipped! Finding next...' });
      
      // 2. 🔥 BUG FIXED: Room destroy karne se PEHLE partner ka variable clear karo
      let roomClients = io.sockets.adapter.rooms.get(currentRoom);
      if(roomClients){
         roomClients.forEach(clientId => {
            let clientSocket = io.sockets.sockets.get(clientId);
            if(clientSocket) clientSocket.strangerRoom = null; // Dono ka variable null ho jayega
         });
      }

      // 3. Ab RAM se room ko hamesha ke liye uda do (Fastest way)
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
    if (socket.userId && connectedUsers[socket.userId]) {
      connectedUsers[socket.userId].delete(socket.id);
      if (connectedUsers[socket.userId].size === 0) {
        delete connectedUsers[socket.userId];
        io.emit('online_status_update', { userId: socket.userId, status: 'offline' });
      }
    }

    // 2. Random Chat Cleanup (Queue se hatao)
    waitingQueue.delete(socket.id);
    
    // 3. Agar room me tha aur net chala gaya (BUG FIXED HERE TOO)
    if (socket.strangerRoom) {
      let currentRoom = socket.strangerRoom;
      socket.to(currentRoom).emit('stranger_disconnected', { message: 'Stranger left unexpectedly due to network loss.' });
      
      // Room destroy karne se pehle partner ka variable clear karo
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
