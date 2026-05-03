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
const connectedUsers = new Map(); // 🔥 Wapas Map lagaya (Super Fast)
const waitingQueue = new Set();   // O(1) Time Complexity

io.on('connection', (socket) => {
  console.log('🟢 Naya User Connect Hua! ID:', socket.id);

  // ==========================================
  // 🟢 1. LIVE ONLINE / OFFLINE SYSTEM (Friend Chat)
  // ==========================================
  socket.on('user_connected', (userId) => {
    socket.data.userId = userId; // 🔥 socket.data ka use kiya (Best Practice)
    
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

  // ==========================================
  // 🤝 2. FRIEND CHAT SYSTEM
  // ==========================================
  socket.on('send_friend_message', (data) => {
    let receiverSockets = connectedUsers.get(data.receiver_id);
    if (receiverSockets && receiverSockets.size > 0) {
      receiverSockets.forEach(socketId => {
        io.to(socketId).emit('receive_friend_message', data);
      });
    }
  });

  socket.on('friend_typing', (data) => {
    let receiverSockets = connectedUsers.get(data.receiver_id);
    if (receiverSockets) receiverSockets.forEach(sId => io.to(sId).emit('friend_is_typing', { sender_id: data.sender_id }));
  });

  socket.on('friend_stop_typing', (data) => {
    let receiverSockets = connectedUsers.get(data.receiver_id);
    if (receiverSockets) receiverSockets.forEach(sId => io.to(sId).emit('friend_stopped_typing', { sender_id: data.sender_id }));
  });

  // ==========================================
  // 🎭 3. RANDOM CHAT SYSTEM (Super Smooth & Fast)
  // ==========================================
  socket.on('find_stranger', () => {
    // 1. Agar user pehle se kisi room me hai, toh waha se nikalo
    if (socket.data.strangerRoom) {
        socket.leave(socket.data.strangerRoom);
        socket.data.strangerRoom = null;
    }

    // 2. 🔥 SPAM PROTECTION: Agar pehle se line me hai toh wapas add mat karo
    if (waitingQueue.has(socket.id)) return;

    let partnerSocket = null;
    let partnerId = null;

    // 🔥 Queue (Line) se zinda partner dhundho
    for (let id of waitingQueue) {
      let tempSocket = io.sockets.sockets.get(id);
      
      if (tempSocket && id !== socket.id) {
        partnerId = id;
        partnerSocket = tempSocket;
        break; 
      } else if (!tempSocket) {
        waitingQueue.delete(id);
      }
    }

    if (partnerSocket) {
      // 🤝 Match Found! Dono ko line se bahar nikalo
      waitingQueue.delete(partnerId);
      waitingQueue.delete(socket.id);

      // Room banao (Unique ID)
      let roomName = 'room_' + Date.now() + '_' + socket.id;
      
      socket.join(roomName);
      partnerSocket.join(roomName);
      
      // 🔥 socket.data ka use kiya
      socket.data.strangerRoom = roomName;
      partnerSocket.data.strangerRoom = roomName;
      
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
    if (socket.data.strangerRoom) socket.to(socket.data.strangerRoom).emit('receive_stranger_message', messageText);
  });

  socket.on('stranger_typing', () => {
    if (socket.data.strangerRoom) socket.to(socket.data.strangerRoom).emit('stranger_is_typing');
  });

  socket.on('stranger_stop_typing', () => {
    if (socket.data.strangerRoom) socket.to(socket.data.strangerRoom).emit('stranger_stopped_typing');
  });

  // ==========================================
  // 🏃‍♂️ 4. SKIP / LEAVE LOGIC (Next Button)
  // ==========================================
  socket.on('skip_stranger', async () => {
    if (socket.data.strangerRoom) {
      let currentRoom = socket.data.strangerRoom;

      // 1. Partner ko batao ki ye chala gaya
      socket.to(currentRoom).emit('stranger_disconnected', { message: 'Stranger skipped! Finding next...' });
      
      // 2. 🔥 BUG FIXED: Modern v4 way with socket.data
      const socketsInRoom = await io.in(currentRoom).fetchSockets();
      for (const s of socketsInRoom) {
          s.data.strangerRoom = null; // Ab ye 100% kaam karega!
      }

      // 3. Ab RAM se room ko hamesha ke liye uda do
      io.in(currentRoom).socketsLeave(currentRoom); 
      
    } else {
      // Agar line me laga tha aur next daba diya, toh line se hatao
      waitingQueue.delete(socket.id);
    }
  });

  // ==========================================
  // 🛑 5. DISCONNECT LOGIC (Net Off / Tab Close)
  // ==========================================
  socket.on('disconnect', async () => {
    console.log('🔴 User Chala Gaya ID:', socket.id);

    // 1. Friend Chat Cleanup
    let userId = socket.data.userId;
    if (userId && connectedUsers.has(userId)) {
      let userSockets = connectedUsers.get(userId);
      userSockets.delete(socket.id);
      
      if (userSockets.size === 0) {
        connectedUsers.delete(userId);
        io.emit('online_status_update', { userId: userId, status: 'offline' });
      }
    }

    // 2. Random Chat Cleanup (Queue se hatao)
    waitingQueue.delete(socket.id);
    
    // 3. Agar room me tha aur net chala gaya
    if (socket.data.strangerRoom) {
      let currentRoom = socket.data.strangerRoom;
      socket.to(currentRoom).emit('stranger_disconnected', { message: 'Stranger left unexpectedly due to network loss.' });
      
      // Room destroy karne se pehle partner ka variable clear karo
      const socketsInRoom = await io.in(currentRoom).fetchSockets();
      for (const s of socketsInRoom) {
          if (s.id !== socket.id) {
              s.data.strangerRoom = null;
          }
      }

      // Room delete karo RAM se
      io.in(currentRoom).socketsLeave(currentRoom);
    }
  });

}); 

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🔥 VELETIFY ENGINE RUNNING ON PORT ${PORT} 🔥`);
});
