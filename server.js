const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { read } = require('fs');

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
        joiningID: 0, // this will be used to assign unique IDs to players
        hasStarted: false // if the game has started then no more players can join
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
    if (lobbies[lobbyId].hasStarted) {
        return res.status(400).json("Game has already started, cannot join");
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
        if (data.action === 'join') { // this is called when a new player joins a lobby, it sets up all the important info for the player
            // telling the player all the important information
            const { lobbyId, playerName } = data;
            ws.lobbyId = lobbyId; // storing the lobby ID in the WebSocket object, its easier to do some things with it later
            let uniqueID = lobbies[lobbyId].joiningID;
            let isMain = false;
            let ready = false;
            if (lobbies[lobbyId].players.length === 0) {
                isMain = true;
                ready = true
            }
            lobbies[lobbyId].joiningID += 1; // incrementing the unique ID for the next player
            lobbies[lobbyId].players.push({"name": playerName, "id": uniqueID, "isMain": isMain, "ws": ws, "position": {x: 0, y: 0}, "ready": ready, "numberOfWins": 0});
            ws.send(JSON.stringify({
                action: 'joined',
                isMain: isMain,
                uniqueID: uniqueID
            }));
            lobbies[lobbyId].players.forEach(player => {
                player.ws.send(JSON.stringify({
                    action: 'lobbyInfo',
                    thisPlayer: { // sending the information about the receiving player, this is used in the ready up switches
                        id: uniqueID,
                        name: playerName,
                        isMain: isMain,
                        ready: ready
                    },
                    players: lobbies[lobbyId].players.map(player => ({
                        id: player.id,
                        name: player.name,
                        isMain: player.isMain,
                        ready: player.ready
                    }))
                }));
            })
        }else if (data.action === "startGame"){ // called when someone requests to start the game
            // checking if the player that requested the game start is the main player
            const lobbyId = ws.lobbyId;
            const player = lobbies[lobbyId].players.find(player => player.ws === ws);
            if (!player || !player.isMain) {
                ws.send(JSON.stringify({ action: 'error', message: 'Only the main player can start the game.' }));
            }else{
                let allReady = true
                lobbies[lobbyId].players.forEach(player => {
                    if (!player.ready) {
                        allReady = false;
                    }
                });
                if (allReady) {
                    // marking the game as started
                    lobbies[lobbyId].hasStarted = true;
                    // sending the game started message to all players in the lobby
                    lobbies[lobbyId].players.forEach(player => {
                        player.ws.send(JSON.stringify({ action: 'gameStarted' }));
                    });
                    console.log(`Game started in lobby ${lobbyId}`);
                }else{
                    ws.send(JSON.stringify({ action: 'error', message: 'Not all players are ready.' }));
                }
            }
        }else if (data.action === "readyUPchange"){ // called when a player readies up or unreadies
            const lobbyId = ws.lobbyId;
            const isReady = data.isReady;
            lobbies[lobbyId].players.forEach(player => {
                if (player.ws === ws) {
                    player.ready = isReady;
                }
            });
            console.log(`Player ${ws.lobbyId} is now ${isReady ? 'ready' : 'not ready'}`);
            // sending the updated player list to all players in the lobby
            lobbies[lobbyId].players.forEach(p => {
                p.ws.send(JSON.stringify({
                    action: 'lobbyInfo',
                    thisPlayer: { // sending the information about the receiving player, this is used in the ready up switches
                        id: p.id,
                        name: p.name,
                        isMain: p.isMain,
                        ready: p.ready
                    },
                    players: lobbies[lobbyId].players.map(player => ({
                        id: player.id,
                        name: player.name,
                        isMain: player.isMain,
                        ready: player.ready
                    }))
                }));
            });
        }
    });

    ws.on('close', () => {
        const lobbyId = ws.lobbyId
        //console.log(lobbies[lobbyId]);
        //console.log(lobbies[lobbyId].players.length);
        // if the player is main and there are more people in the lobby then selecting a new main
        if( lobbies[lobbyId] && lobbies[lobbyId].players.length > 1 && lobbies[lobbyId].players.find(player => player.ws === ws).isMain) {
            // finding the next main player
            const nextMain = lobbies[lobbyId].players.find(player => !player.isMain);
            if (nextMain) {
                nextMain.isMain = true;
                nextMain.ws.send(JSON.stringify({ action: 'newMain' }));
                console.log(`Lobby ${lobbyId} has a new main player: ${nextMain.id}`);
            }
            // removing the player from the lobby
            lobbies[lobbyId].players = lobbies[lobbyId].players.filter(player => player.ws !== ws);
            // sending the updated player list to all players in the lobby
            lobbies[lobbyId].players.forEach(player => {
                player.ws.send(JSON.stringify({
                    action: 'lobbyInfo',
                    players: lobbies[lobbyId].players.map(p => ({
                        id: p.id,
                        name: p.name,
                        isMain: p.isMain,
                        ready: p.ready
                    })),
                    thisPlayer: { // sending the information about the receiving player, this is used in the
                        id: player.id,
                        name: player.name,
                        isMain: player.isMain,
                        ready: player.ready
                    }
                }));
            });
        }else if (lobbies[lobbyId] && lobbies[lobbyId].players.length > 1) { // if a regular player left
            // removing the player from the lobby
            lobbies[lobbyId].players = lobbies[lobbyId].players.filter(player => player.ws !== ws);
            console.log(`Player left lobby ${lobbyId}`);
            // sending the updated player list to all players in the lobby
            lobbies[lobbyId].players.forEach(player => {
                player.ws.send(JSON.stringify({
                    action: 'lobbyInfo',
                    players: lobbies[lobbyId].players.map(player => ({
                        id: player.id,
                        name: player.name,
                        isMain: player.isMain,
                        ready: player.ready
                    })),
                    thisPlayer: { // sending the information about the receiving player, this is used in the ready up switches
                        id: player.id,
                        name: player.name,
                        isMain: player.isMain,
                        ready: player.ready
                    }
                }));
            });
        }else{ // if the last player left the lobby
            // deleting the lobby if there are no players left
            delete lobbies[lobbyId];
            console.log(`Lobby ${lobbyId} deleted due to no players`);
        }
    });
});

// Starting the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});