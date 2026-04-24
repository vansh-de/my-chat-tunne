const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors()); 

const server = http.createServer(app);

// Socket server setup
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// ==========================================
// 🧠 GLOBAL MEMORY (Data Storage in RAM)
// ==========================================
let connectedUsers = {}; // Friend Chat ke liye: Kaunsa user (DB ID) kis socket ID par hai
let waitingStranger = null; // Random chat ka queue (Agar koi akela wait kar raha hai)

io.on('connection', (socket) => {
  console.log('🟢 Naya User Connect Hua! ID:', socket.id);

  // ==========================================
  // 🟢 1. LIVE ONLINE / OFFLINE SYSTEM
  // ==========================================
  
  // Jab PHP/JS frontend batayega ki "Main ye User ID hoon"
  socket.on('user_connected', (userId) => {
    connectedUsers[userId] = socket.id; // DB ID ko Socket ID se jod diya
    socket.userId = userId; // User ID ko is connection me yaad rakhne ke liye
    
    console.log(`User ID ${userId} is Live!`);
    
    // Sabko bata do ki ye bhai Online aagaya hai (Green Dot)
    io.emit('online_status_update', { userId: userId, status: 'online' });
  });


  // ==========================================
  // 🤝 2. FRIEND CHAT SYSTEM (Real-time Private Messaging)
  // ==========================================
  
  // Jab frontend PHP me message save karne ke baad yahan se message bhejega
  socket.on('send_friend_message', (data) => {
    // data me aayega: { sender_id, receiver_id, message, image_path, msg_id }
    console.log(`Message from ${data.sender_id} to ${data.receiver_id}`);
    
    // Check karo kya dost Online hai hamari Tunnel par?
    let receiverSocketId = connectedUsers[data.receiver_id];
    
    if (receiverSocketId) {
      // Dost online hai! Usko instantly message bhej do
      io.to(receiverSocketId).emit('receive_friend_message', data);
    }
  });

  // Friend Typing Animation
  socket.on('friend_typing', (data) => {
    let receiverSocketId = connectedUsers[data.receiver_id];
    if (receiverSocketId) io.to(receiverSocketId).emit('friend_is_typing', { sender_id: data.sender_id });
  });

  socket.on('friend_stop_typing', (data) => {
    let receiverSocketId = connectedUsers[data.receiver_id];
    if (receiverSocketId) io.to(receiverSocketId).emit('friend_stopped_typing', { sender_id: data.sender_id });
  });


  // ==========================================
  // 🎭 3. RANDOM CHAT SYSTEM (No DB, Only Live Tunnel)
  // ==========================================
  
  // Jab koi "Find Stranger" pe click kare
  socket.on('find_stranger', () => {
    
    // Agar pehle se koi waiting list me hai, aur wo "Main" nahi hoon
    if (waitingStranger && waitingStranger.id !== socket.id) {
      // Match Found! Ek private kamra (Room) banao dono ke liye
      let roomName = 'room_' + socket.id + '_' + waitingStranger.id;
      
      // Dono ko kamre me daal do
      socket.join(roomName);
      waitingStranger.join(roomName);
      
      // Yaad rakhne ke liye variables set kar do
      socket.strangerRoom = roomName;
      waitingStranger.strangerRoom = roomName;
      
      // Dono ko bata do ki "Partner Mil Gaya!"
      io.to(roomName).emit('stranger_matched', { status: 'success', message: 'Stranger connected!' });
      
      // Waiting list khali kar do agle naye bande ke liye
      waitingStranger = null; 
      console.log(`Match done in room: ${roomName}`);
    } 
    else {
      // Agar koi nahi hai, toh waiting list me baith jao
      waitingStranger = socket;
      socket.emit('waiting_for_stranger', { status: 'waiting', message: 'Looking for a stranger...' });
      console.log(`Socket ${socket.id} is waiting for stranger.`);
    }
  });

  // Random chat message sending
  socket.on('send_stranger_message', (messageText) => {
    if (socket.strangerRoom) {
      // "socket.to" ka matlab us kamre me sabko bhejo, bas MUJHE chhod kar
      socket.to(socket.strangerRoom).emit('receive_stranger_message', messageText);
    }
  });

  // Random chat typing
  socket.on('stranger_typing', () => {
    if (socket.strangerRoom) socket.to(socket.strangerRoom).emit('stranger_is_typing');
  });

  socket.on('stranger_stop_typing', () => {
    if (socket.strangerRoom) socket.to(socket.strangerRoom).emit('stranger_stopped_typing');
  });

  // Jab user "Next" dabaye (Skip)
  socket.on('skip_stranger', () => {
    if (socket.strangerRoom) {
      // Purane partner ko batao ki wo bhaag gaya
      socket.to(socket.strangerRoom).emit('stranger_disconnected', { message: 'Stranger disconnected. Click Next to find a new one.' });
      
      // Dono ko kamre se bahar nikalo
      socket.leave(socket.strangerRoom);
      socket.strangerRoom = null;
    }
  });


  // ==========================================
  // 🛑 4. DISCONNECT LOGIC (Net off hona ya tab band karna)
  // ==========================================
  socket.on('disconnect', () => {
    console.log('🔴 User Chala Gaya ID:', socket.id);

    // 1. Friend Chat cleanup (Online se Offline dikhao)
    if (socket.userId) {
      delete connectedUsers[socket.userId]; // Uski memory uda do
      io.emit('online_status_update', { userId: socket.userId, status: 'offline' });
    }

    // 2. Random Chat cleanup (Agar wo wait kar raha tha ya baat kar raha tha)
    if (waitingStranger && waitingStranger.id === socket.id) {
      waitingStranger = null; // Line se bahar nikalo
    }
    
    if (socket.strangerRoom) {
      // Agar random chat kar raha tha aur net chala gaya, toh dusre ko bata do
      socket.to(socket.strangerRoom).emit('stranger_disconnected', { message: 'Stranger left unexpectedly.' });
    }
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🔥 VELETIFY ENGINE RUNNING ON PORT ${PORT} 🔥`);
});
