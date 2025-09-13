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

function preloadMapData(mapData){ // this function will add items and such to the map
    let items = [];
    //console.log("here2");
    const spawnChance = 2;
    mapData.tiles.forEach(tile => {
        //console.log("here3");
        //console.log(tile.zones);
        tile.zones.forEach(zone => { // later there will be more zones and this will be done dynamically
            if(zone.name === "Weapons"){ // also for now all the weapons are the same
                if(Math.random() * 100 < spawnChance){
                    items.push({
                        position: { x: tile.x + Math.random() * 0.8 + 0.1, y: tile.y + Math.random() * 0.8 + 0.1 },
                        color: { r: 255, g: 0, b: 0 }
                    });
                }
            }else if(zone.name === "Health"){
                if(Math.random() * 100 < spawnChance){
                    items.push({
                        position: { x: tile.x + Math.random() * 0.8 + 0.1, y: tile.y + Math.random() * 0.8 + 0.1 },
                        color: { r: 0, g: 255, b: 0 }
                    });
                }
            }
        });
    });
    mapData.items = items;
    return mapData;
}

function findNearestItem(playerPosition, items){ // finds the nearest item to the player
    let nearestItem = null;
    let nearestDistance = Infinity;
    items.forEach(item => {
        const distance = calcDistance(playerPosition, item.position);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestItem = item;
        }
    });
    return nearestItem;
}

function validateMapData(mapData){
    // checking if mapData is an object
    if (typeof mapData !== 'object' || mapData === null) {
        return false;
    }

    // checking for required properties
    const requiredProperties = ['name', 'gridSizeX', 'gridSizeY', 'tiles'];
    for (const prop of requiredProperties) {
        if (!mapData.hasOwnProperty(prop)) {
            return false;
        }
    }

    // checking if tiles is an array
    if (!Array.isArray(mapData.tiles)) {
        return false;
    }

    return true;
}

function calcDistance(pos1, pos2) {
    return Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y);
}

let test = true;
function getNearbyTilesAndOtherInfo(player, map, allPlayers){ // function that will return the map tiles that are near enough to the player, this function is here to prevent cheating by the player (if the entire map would be sent then the player could use it to gain an unfair advantage)
    let nearbyTilesAndInfo = {tiles: [], gridSizeX: map.gridSizeX, gridSizeY: map.gridSizeY, nearbyPlayers: [], items: []};
    const viewDistance = 17; // this is the number that limits which tiles can be seen by the player
    //console.log("Player position:", playerX, playerY);
    test = true;
    map.tiles.forEach(tile => {
        //console.log(tile.x, tile.y);
        if (calcDistance(tile, player.position) <= viewDistance && test) {
            nearbyTilesAndInfo.tiles.push(tile);
            //console.log("Player position:", player.position.x, player.position.y);
            //console.log("Tile added:", tile.x, tile.y);
            //console.log("Distance:", calcDistance(tile, player.position));
            //test = false;
        }
        
    });
    allPlayers.forEach(otherPlayer => {
        if (otherPlayer.ws !== player.ws) {
            const distance = calcDistance(otherPlayer.position, player.position);
            if (distance <= viewDistance) {
                nearbyTilesAndInfo.nearbyPlayers.push(otherPlayer.position);
            }
        }
    });
    //console.log(map.items)
    map.items.forEach(item => {
        //console.log(item.x)
        if (calcDistance(item.position, player.position) <= viewDistance) {
            nearbyTilesAndInfo.items.push(item);
        }
    });
    return nearbyTilesAndInfo;
}

const lobbies = {}; // later I will use a database
const mapCreators = {}; // the same as lobbies but this one ensures that no one else can join the map creator tab apart from the creator

app.post('/create-lobby', (req, res) => {
    const {lobbyId, public, password, username} = req.body;
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
        isPublic: public, // if the lobby is public or private
        password: password, // used as an extra security measure for private lobbies
        bullets: [], // this will hold all the bullet objects
        securityString: randomString, // this will be used to ensure that only real players can join the lobby, basically it should prevent someone from just copy pasting the https address into a new window
        map: null
    };
    res.status(200).send({message: "Lobby created successfully", string: randomString}); // sending the random string to the client so that it can be used to join the lobby
});

app.get('/get-public-lobbies', (req, res) => { // this is called when the client wants to get all the public lobbies
    const responseLobbies = Object.keys(lobbies).filter(lobbyId => lobbies[lobbyId].isPublic && lobbies[lobbyId].players.length < 100).map(lobbyId => ({
        id: lobbyId,
        players: lobbies[lobbyId].players.length
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
    }else if (!lobbies[lobbyId].players || lobbies[lobbyId].players.length >= 100) {
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
    if (!lobbies[lobbyId]) {
        return res.status(404).send("Lobby not found");
    }
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
            const { lobbyId, playerName, securityString } = data;
            if( !lobbies[lobbyId]) {
                ws.send(JSON.stringify({ action: 'error', message: 'Lobby not found', fatal: true }));
                return;
            }
            if (lobbies[lobbyId].securityString !== securityString || lobbies[lobbyId].securityString == undefined) {
                ws.send(JSON.stringify({ action: 'error', message: 'Invalid security string', fatal: true }));
                return;
            }
            lobbies[lobbyId].securityString = undefined; // setting the security string to undefined so that no one else can join with the same string
            ws.lobbyId = lobbyId; // storing the lobby ID in the WebSocket object, its easier to do some things with it later
            let uniqueID = lobbies[lobbyId].joiningID;
            let isMain = false;
            let ready = false;
            if (lobbies[lobbyId].players.length === 0) {
                isMain = true;
                ready = true
            }
            // giving the player a random color from the color list
            let color;
            do{
                color = {r: Math.floor(Math.random() * 256), g: Math.floor(Math.random() * 256), b: Math.floor(Math.random() * 256)};
            }while (lobbies[lobbyId].players.some(player => player.color === color)); // ensuring that the color is unique in the lobby
            lobbies[lobbyId].joiningID += 1; // incrementing the unique ID for the next player
            // adding the player to the lobby and giving him info
            lobbies[lobbyId].players.push({"name": playerName, "id": uniqueID, 
                "isMain": isMain, "ws": ws, 
                "position": {x: 0, y: 0, angle: 0}, lastMove: Date.now(), 
                lastMouseMove: Date.now(), "ready": ready,"color":color, 
                interactCooldown: 0, health: 100, inventory: [null, null, null, null, null], selectedItemSlot: 0});
            ws.send(JSON.stringify({
                action: 'joined',
                isMain: isMain,
                uniqueID: uniqueID,
                color: color,
                lobbyId: lobbyId,
                lobbyPassword: lobbies[lobbyId].password || null,
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
        }else if (data.action === "startGame"){ // called when someone requests to start the game
            // checking if the player that requested the game start is the main player
            const lobbyId = ws.lobbyId;
            const player = lobbies[lobbyId].players.find(player => player.ws === ws);
            if (!player || !player.isMain) {
                ws.send(JSON.stringify({ action: 'error', message: 'Only the main player can start the game.', fatal: false }));
            }else{
                let allReady = true
                lobbies[lobbyId].players.forEach(player => {
                    if (!player.ready) {
                        allReady = false;
                    }
                });
                if (allReady && lobbies[lobbyId].map !== null) {
                    // marking the game as started
                    lobbies[lobbyId].hasStarted = true;
                    // sending the game started message to all players in the lobby
                    lobbies[lobbyId].players.forEach(player => {
                        player.ws.send(JSON.stringify({ action: 'gameStarted'}));
                    });
                    // starting the game loop sending of the map
                    lobbies[lobbyId].mapInterval = setInterval(() => {
                        lobbies[lobbyId].players.forEach(player => {
                            //console.log(getNearbyTiles(player, lobbies[lobbyId].map));
                            player.ws.send(JSON.stringify({ action: 'mapData', mapData: getNearbyTilesAndOtherInfo(player, lobbies[lobbyId].map, lobbies[lobbyId].players) }));
                        });
                    }, 1000 / 30); // 30 times a second
                }else if(!allReady){
                    ws.send(JSON.stringify({ action: 'error', message: 'Not all players are ready.' , fatal: false }));
                }else{
                    ws.send(JSON.stringify({ action: 'error', message: 'No map has been selected yet.' , fatal: false }));
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
                ws.send(JSON.stringify({ action: 'error', message: 'Only the main player can change the lobby visibility.', fatal: false }));
                return;
            }
            const visibility = data.visibility; // true for public, false for private
            lobbies[lobbyId].isPublic = visibility;
            lobbies[lobbyId].players.forEach(p => {
                p.ws.send(JSON.stringify({action:"visibilityChange", isPublic: visibility}));
            });
        }else if (data.action === 'keys'){ // is called when a player requests to move or does an action
            const lobbyId = ws.lobbyId;
            const player = lobbies[lobbyId].players.find(player => player.ws === ws);
            if (lobbies[lobbyId].hasStarted === true) {
                // moving the player based on the keys pressed
                if(player.lastMove + 10 < Date.now()){ // limiting the movement updates to 100 per second
                    player.lastMove = Date.now();
                    let speedMultiplier = 1;
                    if(data.keys.length > 1) speedMultiplier = 0.7;
                    if(data.keys.includes('a')) player.position.x -= 0.1 * speedMultiplier;
                    if(data.keys.includes('d')) player.position.x += 0.1 * speedMultiplier;
                    if(data.keys.includes('s')) player.position.y += 0.1 * speedMultiplier;
                    if(data.keys.includes('w')) player.position.y -= 0.1 * speedMultiplier;
                    player.position.x = Math.round(player.position.x * 100) / 100;
                    player.position.y = Math.round(player.position.y * 100) / 100;
                    //console.log(player.position);
                    player.ws.send(JSON.stringify({ action: 'positionUpdate', position: player.position }));
                }
            }
        }else if(data.action === 'interact'){ // called when the player interacts with an item
            const lobbyId = ws.lobbyId;
            const player = lobbies[lobbyId].players.find(player => player.ws === ws);
            if (player && lobbies[lobbyId].hasStarted === true && player.interactCooldown + 500 < Date.now()) {
                let nearestItem = findNearestItem(player.position, lobbies[lobbyId].map.items);
                if (nearestItem && calcDistance(player.position, nearestItem.position) < 1.5) {
                    // removing the item from the map
                    lobbies[lobbyId].map.items = lobbies[lobbyId].map.items.filter(item => item !== nearestItem);
                    player.interactCooldown = Date.now();
                    // adding the item to the player's inventory if there is space
                    let added = false;
                    // first trying to add the item to the selected slot
                    if (player.inventory[player.selectedItemSlot] === null) {
                        player.inventory[player.selectedItemSlot] = nearestItem;
                        added = true;
                    }else{
                        // then trying to add the item to any other slot
                        for (let i = 0; i < player.inventory.length; i++) {
                            if (player.inventory[i] === null) {
                                player.inventory[i] = nearestItem;
                                added = true;
                                break;
                            }
                        }
                    }
                    if (added) {
                        player.ws.send(JSON.stringify({ action: 'inventoryUpdate', inventory: player.inventory }));
                    }
                }
            }
        }else if(data.action === 'loadMap'){ // called when the main player selects a map
            const lobbyId = ws.lobbyId;
            const player = lobbies[lobbyId].players.find(player => player.ws === ws);
            if (player && player.isMain) {
                const isValid = validateMapData(data.mapData);
                if(isValid){
                    const finishedMapData = preloadMapData(data.mapData);
                    lobbies[lobbyId].map = finishedMapData;
                    //console.log(lobbies[lobbyId].map.items);
                    lobbies[lobbyId].players.forEach(p => {
                        p.ws.send(JSON.stringify({ action: 'mapSelected', name: finishedMapData.name }));
                    });
                }else{
                    ws.send(JSON.stringify({ action: 'error', message: 'Invalid map data!' }));
                }
            }else{
                ws.send(JSON.stringify({ action: 'error', message: 'You are not the main player!' }));
            }
        }else if (data.action === 'mouseMove'){
            const lobbyId = ws.lobbyId;
            const player = lobbies[lobbyId].players.find(player => player.ws === ws);
            if(lobbies[lobbyId].hasStarted === true){
                if (player && player.lastMouseMove + 10 < Date.now()) { // limiting the mouse move updates to 100 per second
                    player.position.angle = Math.atan2(data.y - data.center.y, data.x - data.center.x);
                    player.ws.send(JSON.stringify({ action: 'positionUpdate', position: player.position }));
                    player.lastMouseMove = Date.now();
                }
            }
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
        }else if (data.action === "verifyMap"){ // decides whether a map is valid or not
            const {mapData} = data;
            let isInLobby = false;
            let isMain = false;
            for (const lobby of Object.values(lobbies)) {
                if (lobby.players.forEach(player => {
                    if (player.ws === ws) {
                        isInLobby = true;
                        isMain = player.isMain;
                    }
                })) {
                    break;
                }
            }
            const isValid = validateMapData(mapData); // performing the validation
            if (isValid && !isInLobby || isValid && isMain) {
                ws.send(JSON.stringify({ action: 'mapVerificationResult', valid: true, mapData: mapData}));
            } else if(isValid && isInLobby && !isMain){
                ws.send(JSON.stringify({ action: 'mapVerificationResult', valid: false, errorMessage: 'You are not the main player!' }));
            } else if(!isValid && isInLobby && isMain || !isValid && !isInLobby && !isMain){
                ws.send(JSON.stringify({ action: 'mapVerificationResult', valid: false, errorMessage: 'Invalid map data!' }));
            }
        }else if (data.action === "selectItemSlot"){ // called when the player selects an item slot
            const lobbyId = ws.lobbyId;
            const player = lobbies[lobbyId].players.find(player => player.ws === ws);
            if (player && lobbies[lobbyId].hasStarted === true && data.selectedItemSlot >= 0 && data.selectedItemSlot < 5) {
                player.selectedItemSlot = data.selectedItemSlot;
            }
            player.ws.send(JSON.stringify({ action: 'itemSlotChange', selectedItemSlot: player.selectedItemSlot }));
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