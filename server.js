const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allows connections from any frontend during testing
        methods: ["GET", "POST"]
    }
});

// This object will hold all our active game rooms
const rooms = {}; 

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // 1. Create Room
    socket.on('create_room', (playerName) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            code: roomCode,
            players: [{ id: socket.id, name: playerName, isHost: true }]
        };
        
        socket.join(roomCode);
        socket.emit('room_created', { roomCode, players: rooms[roomCode].players });
        console.log(`Room ${roomCode} created by ${playerName}`);
    });

    // 2. Join Room
    socket.on('join_room', ({ roomCode, playerName }) => {
        const code = roomCode.toUpperCase();
        const room = rooms[code];

        if (!room) {
            socket.emit('join_error', 'Room not found!');
            return;
        }

        if (room.players.length >= 4) {
            socket.emit('join_error', 'Room is full! (Max 4 players)');
            return;
        }

        // Add player to the room list
        room.players.push({ id: socket.id, name: playerName, isHost: false });
        socket.join(code);

        // Tell everyone in the room that a new player joined
        io.to(code).emit('room_updated', { roomCode: code, players: room.players });
        console.log(`${playerName} joined Room ${code}`);
    });

    // 3. Handle Disconnects
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Clean up rooms if players leave
        for (const code in rooms) {
            const room = rooms[code];
            const index = room.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);
                if (room.players.length === 0) {
                    delete rooms[code]; // Delete empty room
                    console.log(`Room ${code} deleted because it is empty.`);
                } else {
                    // If host left, assign a new host
                    if (index === 0 && room.players.length > 0) {
                        room.players[0].isHost = true;
                    }
                    io.to(code).emit('room_updated', { roomCode: code, players: room.players });
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
