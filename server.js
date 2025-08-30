const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const lobbies = {}; // later I will use a database
const mapCreators = {}; // the same as lobbies but this one ensures that no one else can join the map creator tab apart from the creator

app.post('/create-lobby', (req, res) => {
    const {lobbyId, public, password, username, maxPlayers} = req.body;
    // validating the lobby ID, password and username
    if (!lobbyId || lobbyId.length < 5) {
        return res.status(400).json("Lobby ID must be at least 5 characters long");
    }
    if (!username || username.length < 3 || username.length > 18) {
        return res.status(400).json("Invalid username, must be between 3 and 18 characters long");
    }
    if (!lobbyId || lobbies[lobbyId]) {
        return res.status(400).json("Invalid lobby ID or lobby already exists");
    }
    if (password.length < 3 && !public) { // if the lobby is private then the password must be at least 3 characters long
        return res.status(400).json("Password must be at least 3 characters long for private lobbies");
    }
    let randomString = ''
    for (let i = 0; i < 5; i++) { // generating a random string of 5 characters to be used for security reasons
        randomString += String.fromCharCode(Math.floor(Math.random() * 26) + 97);
    }
    lobbies[lobbyId] = {
        players: [],
        joiningID: 0, // this will be used to assign unique IDs to players
        hasStarted: false, // if the game has started then no more players can join
        isOpen: true, // if the lobby is open for joining
        isPublic: public, // if the lobby is public or private
        password: password, // used as an extra security measure for private lobbies
        maxPlayers: maxPlayers, // maximum number of players that will be allowed to join
        bullets: [], // this will hold all the bullet objects
        securityString: randomString, // this will be used to ensure that only real players can join the lobby, basically it should prevent someone from just copy pasting the https address into a new window
    };
    res.status(200).send({message: "Lobby created successfully", string: randomString}); // sending the random string to the client so that it can be used to join the lobby
});

app.get('/get-public-lobbies', (req, res) => { // this is called when the client wants to get all the public lobbies
    const responseLobbies = Object.keys(lobbies).filter(lobbyId => lobbies[lobbyId].isPublic && lobbies[lobbyId].isOpen).map(lobbyId => ({
        id: lobbyId,
        players: lobbies[lobbyId].players.length,
        maxPlayers: lobbies[lobbyId].maxPlayers,
        isOpen: lobbies[lobbyId].isOpen,
    }));
    if (responseLobbies.length === 0) {
        return res.status(200).json({ message: "No public lobbies are currently available" });
    }
    res.status(200).json(responseLobbies);
});

app.get('/random-username', (req, res) => { // this is called when a client requests to get a random username
    // loading the random names from the file
    let allNames;
    try {
        allNames = require('./sources/names.json');
    } catch (error) {
        return res.status(500).json("Error loading names on the servers side. Sorry :(");
    }
    // generating a random name from the list
    const result = `${allNames["firstNames"][Math.floor(Math.random() * allNames["firstNames"].length)]} ${allNames["lastNames"][Math.floor(Math.random() * allNames["lastNames"].length)]}`;
    res.status(200).json( result );
})

app.post('/join-lobby', (req, res) => { // this is called when a player wants to join a lobby
    const {lobbyId, playerName, password} = req.body;
    // checking if the lobby exists and if it is open for joining
    if(!lobbies[lobbyId]) {
        return res.status(400).json("Lobby not found");
    }
    if (lobbies[lobbyId].hasStarted) {
        return res.status(400).json("Game has already started, cannot join");
    }else if (!lobbies[lobbyId].isOpen) {
        return res.status(400).json("Lobby is full or not open for joining");
    }
    if (lobbies[lobbyId].isPublic === false && password !== lobbies[lobbyId].password){
        return res.status(400).json("Incorrect password for private lobby");
    }
    // validating the player name and lobby ID
    if (!playerName || playerName.length < 3 || playerName.length > 18) {
        return res.status(400).json("Invalid player name, must be between 3 and 18 characters long");
    }
    if (lobbyId.length < 5) {
        return res.status(400).json("Lobby ID must be at least 5 characters long");
    }
    let randomString = '';
    for (let i = 0; i < 5; i++) {
        randomString += String.fromCharCode(Math.floor(Math.random() * 26) + 97);
    }
    lobbies[lobbyId].securityString = randomString; // updating the security string for the lobby
    res.status(200).send({ message: "Joining lobby", securityString: randomString }); // sending the security string to the client so that it can be used to join the lobby
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mainMenu.html'));
});

function combineAllServerMaps(){
    const files = fs.readdirSync(path.join(__dirname, 'sources/maps'));
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    const data = [];
    for (const file of jsonFiles) {
        const filePath = path.join(__dirname, 'sources/maps', file);
        const fileData = fs.readFileSync(filePath);
        try {
            const parsed = JSON.parse(fileData);
            data.push(parsed);
        } catch (error) {}
    }
    return data;
}

app.get('/mainMaps', (req, res) => {
    const combinedMaps = combineAllServerMaps();
    res.status(200).json(combinedMaps);
});

app.get('/game/:lobbyId', (req, res) => {
    const lobbyId = req.params.lobbyId;
    const securityString = req.query.securityString;
    if (!lobbies[lobbyId]) {
        return res.status(404).send("Lobby not found");
    }
    if (lobbies[lobbyId].securityString !== securityString || lobbies[lobbyId].securityString == undefined) {
        return res.status(403).send("Invalid security string");
    }
    lobbies[lobbyId].securityString = undefined; // clearing the security string so that it cannot be used again
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

app.post("/custom-map-creator", (req, res) => {
    let randomString = ''
    do {
        randomString = '';
        for (let i = 0; i < 5; i++) {
            randomString += String.fromCharCode(Math.floor(Math.random() * 26) + 97);
        }
    } while (mapCreators[randomString]); // ensuring that the random string is unique
    mapCreators[randomString] = {
        randomString: randomString,
        ws: undefined, // this will hold the WebSocket connection of the creator
    }
    res.status(200).json({ message: "Map created successfully" , randomString: randomString }); // sending the random string to the client so that it can be used to join the map creator
});

app.get('/mapCreator/:randomString', (req, res) => {
    const randomString = req.params.randomString;
    if (!mapCreators[randomString]) {
        return res.status(404).send("Map creator not found");
    }
    if (mapCreators[randomString].randomString == undefined) {
        return res.status(403).send("Map creator already in use");
    }
    res.sendFile(path.join(__dirname, 'public', 'mapCreator.html'));
});

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.action === 'join') { // this is called when a new player joins a lobby, it sets up all the important info for the player
            // telling the player all the important information
            const { lobbyId, playerName } = data;
            if( !lobbies[lobbyId]) {
                ws.send(JSON.stringify({ action: 'error', message: 'Lobby not found' }));
                return;
            }
            ws.lobbyId = lobbyId; // storing the lobby ID in the WebSocket object, its easier to do some things with it later
            let uniqueID = lobbies[lobbyId].joiningID;
            let isMain = false;
            let ready = false;
            if (lobbies[lobbyId].players.length === 0) {
                isMain = true;
                ready = true
            }
            // giving the player a random color from the color list
            const colors = [{r: 255, g: 0, b: 0}, {r: 0, g: 255, b: 0}, {r: 0, g: 0, b: 255}, {r: 255, g: 255, b: 0}, {r: 255, g: 165, b: 0}];
            let color;
            do{
                color = colors[Math.floor(Math.random() * colors.length)];
            }while (lobbies[lobbyId].players.some(player => player.color === color)); // ensuring that the color is unique in the lobby
            lobbies[lobbyId].joiningID += 1; // incrementing the unique ID for the next player
            // adding the player to the lobby and giving him info
            lobbies[lobbyId].players.push({"name": playerName, "id": uniqueID, "isMain": isMain, "ws": ws, "position": {x: 0, y: 0, angle: 0}, "mousePos":{x:0, y:0}, "ready": ready,"color":color, "numberOfWins": 0});
            ws.send(JSON.stringify({
                action: 'joined',
                isMain: isMain,
                uniqueID: uniqueID,
                color: color,
                lobbyId: lobbyId,
                lobbyPassword: lobbies[lobbyId].password || null,
                maxPlayers: lobbies[lobbyId].maxPlayers,
                isPublic: lobbies[lobbyId].isPublic,
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
            // if the lobby is full then marking it as not open for joining
            if (lobbies[lobbyId].players.length >= lobbies[lobbyId].maxPlayers) {
                lobbies[lobbyId].isOpen = false;
                // sending the updated lobby status to all players in the lobby
                lobbies[lobbyId].players.forEach(player => {
                    player.ws.send(JSON.stringify({action:"statusChange", isOpen: false}));
                });
                console.log(`Lobby ${lobbyId} is now full`);
            }
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
                        player.ws.send(JSON.stringify({ action: 'gameStarted', isMain: player.isMain })); // isMain has to be sent because of map requesting that is done later
                    });
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
        }else if(data.action === 'changeLobbyVisibility'){ // called when the main player wants to change the visibility of the lobby
            const lobbyId = ws.lobbyId;
            const player = lobbies[lobbyId].players.find(player => player.ws === ws);
            if (!player || !player.isMain) {
                ws.send(JSON.stringify({ action: 'error', message: 'Only the main player can change the lobby visibility.' }));
                return;
            }
            const visibility = data.visibility; // true for public, false for private
            lobbies[lobbyId].isPublic = visibility;
            lobbies[lobbyId].players.forEach(p => {
                p.ws.send(JSON.stringify({action:"visibilityChange", isPublic: visibility}));
            });
        }else if(data.action === 'requestMap'){ // sends the map 30 times a second to all the players, later it will be optimalized
            const lobbyId = ws.lobbyId;
            // this is a test map, later it will be done with json files
            // all of the positional values will be multiplied by the scale factor of the clients browser
            
            // loading the map from the file will be done later

            // setting the locations of the players to the spawn points
            lobbies[lobbyId].players.forEach((player, index) => {
                player.position.x = map.spawnPoints[index % map.spawnPoints.length].x
                player.position.y = map.spawnPoints[index % map.spawnPoints.length].y
            });
            // sending the map 30 times a second to all players in the lobby
            lobbies[lobbyId].mapInterval = setInterval(() => {
                // sending all the important info
                lobbies[lobbyId].players.forEach(player => {
                    player.ws.send(JSON.stringify({
                        action: 'mapData',
                        mapData: map,
                        players: lobbies[lobbyId].players.map(p => ({
                            id: p.id,
                            name: p.name,
                            position: p.position,
                            isMain: p.isMain,
                            color: p.color,
                        }))
                    }));
                });
            }, 1000 / 30);
        }else if (data.action === 'move'){ // is called when a player requests to move
            const lobbyId = ws.lobbyId;
            const player = lobbies[lobbyId].players.find(player => player.ws === ws);
            // moving the player based on the keys pressed
            if (data.keys.includes('w')) {
                player.position.y -= 0.05; // moving up
            }
            if (data.keys.includes('s')) {
                player.position.y += 0.05; // moving down
            }
            if (data.keys.includes('a')) {
                player.position.x -= 0.05; // moving left
            }
            if (data.keys.includes('d')) {
                player.position.x += 0.05; // moving right
            }
            player.position.x = Math.round(player.position.x*100)/100
            player.position.y = Math.round(player.position.y*100)/100
            // calculating the angle based on the new position
            const tileSize = data.tileSize;
            let x = player.position.x * tileSize + tileSize / 2
            let y = plmapCreatorsayer.position.y * tileSize + tileSize / 2
            player.position.angle = Math.atan2(player.mousePos.y - y, player.mousePos.x - x);
        }else if (data.action === 'mouseMove'){
            // getting the players position and calculating the angle to the mouse position
            const lobbyId = ws.lobbyId;
            const player = lobbies[lobbyId].players.find(player => player.ws === ws);
            player.mousePos.x = data.x;
            player.mousePos.y = data.y;
            const tileSize = data.tileSize;
            let x = player.position.x * tileSize + tileSize / 2
            let y = player.position.y * tileSize + tileSize / 2
            player.position.angle = Math.atan2(player.mousePos.y - y, player.mousePos.x - x);
        }else if (data.action === 'click'){
            // shooting here
        }else if (data.action === "joinCreator"){ // when someone opens a creator window tab
            const {randomString} = data;
            ws.rString = randomString; // storing the random string in the WebSocket object, its easier to do some things with it later
            if(randomString in mapCreators){
                mapCreators[randomString].ws = ws; // setting the WebSocket connection of the creator
                mapCreators[randomString].randomString = undefined
            }else{
                ws.send(JSON.stringify({ action: 'destroyPage'})); // specificaly on mobile I was able to load the page without the server resending me the files. 
                // Basically I could open a preview that was saved on my phone and the javascript called the server for join request but the creator didnt exist anymore so it caused an error and the server crashed
            }
        }
    });

    ws.on('close', () => {
        const lobbyId = ws.lobbyId
        if (lobbyId == undefined){
            // deleting the map creator if the creator left
            const rString = ws.rString;
            if (mapCreators[rString]) {
                delete mapCreators[rString];
                return;
            }
        }
        // if the player is main and there are more people in the lobby then selecting a new main
        if( lobbies[lobbyId] && lobbies[lobbyId].players.length > 1 && lobbies[lobbyId].players.find(player => player.ws === ws).isMain) {
            // finding the next main player
            const nextMain = lobbies[lobbyId].players.find(player => !player.isMain);
            if (nextMain) {
                nextMain.isMain = true;
                nextMain.ws.send(JSON.stringify({ action: 'newMain' }));
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
            // opening the lobby for joining if there are less players than the maximum
            if (lobbies[lobbyId].players.length < lobbies[lobbyId].maxPlayers) {
                lobbies[lobbyId].isOpen = true;
                // sending the updated lobby status to all players in the lobby
                lobbies[lobbyId].players.forEach(player => {
                    player.ws.send(JSON.stringify({action:"statusChange", isOpen: true}));
                });
            }
        }else{ // if the last player left the lobby
            // stopping the interval that sends the map data
            if (lobbies[lobbyId] && lobbies[lobbyId].mapInterval) {
                clearInterval(lobbies[lobbyId].mapInterval);
            }
            // deleting the lobby if there are no players left
            delete lobbies[lobbyId];
        }
    });
});

// Starting the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});