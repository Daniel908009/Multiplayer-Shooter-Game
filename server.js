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
        return res.status(400).json("Invalid lobby ID or lobby already exists");
    }
    lobbies[lobbyId] = {
        players: [],
        joiningID: 0 // this will be used to assign unique IDs to players
    };
    console.log(lobbies);
    res.status(200).send('Lobby created successfully');
    console.log(`Lobby created with ID: ${lobbyId}`);
});

app.post('/join-lobby', (req, res) => {
    const {lobbyId, playerName} = req.body;
    if(!lobbies[lobbyId]) {
        return res.status(400).json("Lobby not found");
    }
    console.log(`Player ${playerName} joined lobby ${lobbyId}`);
    res.status(200).send("joined successfully");
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mainMenu.html'));
});

app.get('/game/:lobbyId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.action === 'join') {
            // telling the player all the important information
            const { lobbyId, playerName } = data;
            ws.lobbyId = lobbyId; // storing the lobby ID in the WebSocket object, its easier to do some things with it later
            let uniqueID = lobbies[lobbyId].joiningID;
            let isMain = false;
            //console.log("+++++++++++++++++++++++++++++");
            //console.log(lobbies[lobbyId].players.length);
            if (lobbies[lobbyId].players.length === 0) {
                isMain = true;
            }
            lobbies[lobbyId].joiningID += 1; // incrementing the unique ID for the next player
            lobbies[lobbyId].players.push({"name": playerName, "id": uniqueID, "isMain": isMain, "ws": ws});
            ws.send(JSON.stringify({
                action: 'joined',
                isMain: isMain,
                uniqueID: uniqueID
            }));
        }
    });

    ws.on('close', () => {
        const lobbyId = ws.lobbyId
        // if the player is main and there are more people in the lobby then selecting a new main
        //console.log("++++++++++++++++++++++++++++++")
        //console.log(ws)
        //console.log(lobbyId)
        //console.log(lobbies[lobbyId].players);
        if(lobbies[lobbyId].players.length > 1 && lobbies[lobbyId].players.find(player => player.isMain && player.ws === ws)) {
            // finding the next main player
            const nextMain = lobbies[lobbyId].players.find(player => !player.isMain);
            if (nextMain) {
                nextMain.isMain = true;
                nextMain.ws.send(JSON.stringify({ action: 'newMain' }));
                console.log(`Lobby ${lobbyId} has a new main player: ${nextMain.id}`);
            }
            // removing the player from the lobby
            lobbies[lobbyId].players = lobbies[lobbyId].players.filter(player => player.ws !== ws);
        }else{
            //deleting the lobby
            delete lobbies[lobbyId];
            console.log(`Lobby ${lobbyId} deleted due to last player leaving`);
        }
    });
});

// Starting the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});