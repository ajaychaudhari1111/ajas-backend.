const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// ૧. MongoDB કનેક્શન (Render ના Environment Variable માંથી આવશે)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://chaudhreeajay_db_user:royal5123@cluster0.n6ychpj.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB સાથે કનેક્શન સફળ થયું!"))
  .catch(err => console.log("ડેટાબેઝ એરર: ", err));

// ૨. ડેટાબેઝ સ્કીમા
const UserSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, default: "" },
  isOnline: { type: Boolean, default: false }
}, { timestamps: true });

const MessageSchema = new mongoose.Schema({
  sender: String,
  recipient: String,
  text: String,
  status: { type: String, default: 'sent' }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// ૩. રીઅલ-ટાઇમ સોકેટ કનેક્શન
const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('setup_user', (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit('user_status', { userId, isOnline: true });
  });

  socket.on('send_message', async (data) => {
    const { sender, recipient, text } = data;
    const msg = await Message.create({ sender, recipient, text });
    
    const recipientSocket = onlineUsers.get(recipient);
    if (recipientSocket) {
      io.to(recipientSocket).emit('receive_message', msg);
    }
  });

  socket.on('disconnect', () => {
    for (let [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        io.emit('user_status', { userId: uid, isOnline: false });
        break;
      }
    }
  });
});

// ૪. એડમિન API (બધા યુઝર્સ જોવા માટે)
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ total_users: users.length, users: users });
  } catch (err) {
    res.status(500).json({ error: "ડેટા ફેચ કરવામાં ભૂલ આવી" });
  }
});

app.get('/', (req, res) => {
  res.send("Ajas App Backend સર્વર લાઈવ ચાલી રહ્યું છે!");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`સર્વર પોર્ટ ${PORT} પર ચાલુ છે`);
});
