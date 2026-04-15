const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
// CORS ka matlab hai ki tumhari Hostinger wali website is Render tunnel se baat kar sake.
app.use(cors()); 

const server = http.createServer(app);

// Socket server setup
const io = new Server(server, {
  cors: {
    origin: "*", // Abhi ke liye sabko allow kiya hai. Baad mein yahan apni website ka URL daal sakte ho.
    methods: ["GET", "POST"]
  }
});

// Jab bhi koi naya user website open karke connect hoga
io.on('connection', (socket) => {
  console.log('Ek naya user aaya! ID:', socket.id);

  // Jab koi user message bhejta hai (Front-end se 'send_message' aayega)
  socket.on('send_message', (data) => {
    console.log('Message Aaya:', data);
    
    // Ye code jisne message bheja hai, usko chhod kar baaki sabko message bhej dega
    socket.broadcast.emit('receive_message', data);
  });

  // Jab user website band karke chala jata hai
  socket.on('disconnect', () => {
    console.log('User chala gaya 😢 ID:', socket.id);
  });
});

// Render apne aap ek PORT deta hai, agar nahi dega toh 3000 use hoga
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Tumhari tunnel chal rahi hai PORT ${PORT} par! 🚀`);
});
