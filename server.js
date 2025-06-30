const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const lobbies = {}; // later I will use a database

app.post('/create-lobby', (req, res) => {
    const {lobbyId} = req.body
    if (!lobbyId || lobbies[lobbyId]) {
        return res.status(400).json({ error: 'Invalid or duplicate lobby ID' });
    }
    lobbies[lobbyId] = [];
    res.status(200).send('Lobby created successfully');
});

app.post('/join-lobby', (req, res) => {
    const {lobbyId, playerName} = req.body;
    if (!playerName) {
        return res.status(400).json({ error: 'Player name is required' });
    }
    if (!lobbies[lobbyId]) {
        return res.status(404).json({ error: 'Lobby not found' });
    }else{
        lobbies[lobbyId].push(playerName);
        res.status(200).send('Joined lobby successfully');
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mainMenu.html'));
});

app.get('/lobby/:lobbyId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (action === 'join') {
            console.log(`Player ${data.playerName} joined lobby ${data.lobbyId}`);
        }
    });
});

ws.on("close", () => {
    console.log("Client disconnected");
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});