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
                //let type = Math.random() < 0.5 ? "pistol" : "grenade"; // 50% chance for pistol or grenade
                let type = "pistol"; // grenades are not implemented yet and I dont have the time to do it rn
                let bulletType, ammo;
                if(type === "pistol"){
                    bulletType = "small";
                    ammo = Math.floor(Math.random() * 7) + 1; // 1-7 bullets in a pistol
                }
                if(Math.random() * 100 < spawnChance){
                    items.push({
                        type: type,
                        position: { x: tile.x + Math.random() * 0.8 + 0.1, y: tile.y + Math.random() * 0.8 + 0.1 },
                        bulletType: bulletType,
                        ammo: ammo,
                        lastFired: 0, // timestamp of when the weapon was last fired, used for rate of fire
                        color: {r: 255, g: 0, b: 0} // red color is the default for weapons
                    });
                }
            }else if(zone.name === "Health"){
                if(Math.random() * 100 < spawnChance){
                    items.push({
                        type: "health",
                        position: { x: tile.x + Math.random() * 0.8 + 0.1, y: tile.y + Math.random() * 0.8 + 0.1 },
                    });
                }
            }
        });
    });
    mapData.items = items;
    return mapData;
}

function allowedPosition(position, map, direction){ // checks if the position is allowed, meaning its not in a wall or outside of the map
    //return true; // disabling for now
    // setting offsets based on direction
    const xOffset = direction === "left" ? -1 : direction === "right" ? 1 : 0;
    const yOffset = direction === "up" ? -1 : direction === "down" ? 1 : 0;
    //console.log(position.x, position.y);
    //console.log(Math.floor(position.x) + xOffset, Math.floor(position.y) + yOffset);
    //console.log(xOffset, yOffset);
    //return true; // temp
    const tile = findNearestTile({x: position.x + xOffset, y: position.y + yOffset}, map.tiles).nearestTile;
    /*let tile = map.tiles.find(t => {
        t.x = Math.floor(position.x) + xOffset;
        t.y = Math.floor(position.y) + yOffset;
    });*/
    //return true; // temp
    if (!tile) return false; // not on a tile

    // Check if the position is within the bounds of the map
    if (direction === "left" || direction === "right") {
        if (position.x < 0.75 || position.x + 0.75 >= map.gridSizeX){
            //console.log("out of bounds");
            return false;
        }
        let tilesArray = [tile, map.tiles.find(t => t.x === tile.x && t.y === tile.y + 1), map.tiles.find(t => t.x === tile.x && t.y === tile.y - 1)];
        // checking if a part of the player is in the tilesArray, if so then checking if the tile is walkable
        for (const t of tilesArray) {
            if (t && !t.type.walkable)  { // this works because the player is 3 tiles wide and tall
                //console.log("not walkable");
                return false;
            }
        }
    } else if (direction === "up" || direction === "down") {
        if (position.y < 0.75 || position.y + 0.75 >= map.gridSizeY) {
            //console.log("out of bounds");
            return false;
        }
        let tilesArray = [tile, map.tiles.find(t => t.x === tile.x + 1 && t.y === tile.y), map.tiles.find(t => t.x === tile.x - 1 && t.y === tile.y)];
        // checking if a part of the player is in the tilesArray, if so then checking if the tile is walkable
        for (const t of tilesArray) {
            if (t && !t.type.walkable) {
                //console.log("not walkable");
                return false;
            }
        }
    }
    //console.log(tile);
    // Check if the tile is walkable
    //if (!tile.type.walkable) return false;

    return true;
}

function findNearestTile(playerPosition, tiles){ // finds the nearest tile to the player
    let nearestTile = null;
    let nearestDistance = Infinity;
    tiles.forEach(tile => {
        const distance = calcDistance(playerPosition, {x: tile.x + 0.5, y: tile.y + 0.5}); // calculating distance to the center of the tile
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestTile = tile;
        }
    });
    return {nearestTile, nearestDistance};
}

function findNearestPlayers(player, allPlayers){ // finds the nearest player to the given player
    let nearestPlayers = [];
    // adding the player to the array and ordering the array by distance
    allPlayers.forEach(p => {
        if (p.ws !== player.ws && p.alive) {
            const distance = calcDistance(player.position, p.position);
            nearestPlayers.push({player: p, distance: distance});
        }
    });
    nearestPlayers.sort((a, b) => a.distance - b.distance);
    return nearestPlayers.map(p => p.player); // returning only the players, not the distance
}

function speedModifierOfCurrentTile(playerPosition, map){ // finds the tile the player is currently on and returns the speed modifier of that tile
    let currentTile = findNearestTile(playerPosition, map.tiles);
    if (currentTile.nearestDistance < 0.75) {
        //console.log(currentTile);
        return currentTile.nearestTile.type.speedModifier;
    }
    //console.log("No tile found for player position:", playerPosition);
    //console.log("Nearest tile:", currentTile.nearestTile, "Distance:", currentTile.nearestDistance);
    return 0.5;
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

function validateMapData(mapData){ // function that validates the map received from the client
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

function getNearbyTilesAndOtherInfo(player, map, allPlayers, bullets, grenades){ // function that will return the map tiles that are near enough to the player, this function is here to prevent cheating by the player (if the entire map would be sent then the player could use it to gain an unfair advantage)
    let nearbyTilesAndInfo = {tiles: [], darkTiles: [], gridSizeX: map.gridSizeX, gridSizeY: map.gridSizeY, nearbyPlayers: [], items: [], bullets: [], grenades: []};
    const viewDistance = 18; // this is the number that limits which tiles/items/players can be seen by the player
    const showingDistance = viewDistance*2.5 > 39 ? viewDistance*2.5 : 39; // this is the distance at which tiles will still be sent to the client, but they will be drawn darker
    // getting the nearby tiles
    map.tiles.forEach(tile => {
        //console.log(tile.x, tile.y);
        let distanceToTile = calcDistance(tile, player.position);
        if (distanceToTile <= viewDistance) { // later this will be done as a rectangle instead of distance so that it wont be possible to cheat, DO THIS
            nearbyTilesAndInfo.tiles.push(tile);
            //console.log("Player position:", player.position.x, player.position.y);
            //console.log("Tile added:", tile.x, tile.y);
            //console.log("Distance:", calcDistance(tile, player.position));
            //test = false;
        }else if(distanceToTile <= showingDistance){
            nearbyTilesAndInfo.darkTiles.push(tile);
        }
    });
    // getting the nearby players
    allPlayers.forEach(otherPlayer => {
        if (otherPlayer.ws !== player.ws) {
            const distance = calcDistance(otherPlayer.position, player.position);
            if (distance <= viewDistance) {
                nearbyTilesAndInfo.nearbyPlayers.push({
                    name: otherPlayer.name,
                    position: otherPlayer.position,
                    health: otherPlayer.health,
                    color: otherPlayer.color
                });
            }
        }
    });
    // getting the items
    map.items.forEach(item => {
        //console.log(item.x)
        if (calcDistance(item.position, player.position) <= viewDistance) {
            nearbyTilesAndInfo.items.push(item);
        }
    });
    // getting the bullets
    bullets.forEach(bullet => {
        if (calcDistance(bullet.position, player.position) <= viewDistance) {
            nearbyTilesAndInfo.bullets.push({position: bullet.position, 
            bulletType: bullet.bulletType,
            angle: bullet.angle});// only sending the necessary info about the bullet
        }
    });
    // getting the grenades
    if (grenades) {
        grenades.forEach(grenade => {
            if (calcDistance(grenade.position, player.position) <= viewDistance) {
                nearbyTilesAndInfo.grenades.push({ position: grenade.position,
                angle: grenade.angle,
                timeToExplode: grenade.timeToExplode });
            }
        });
    }
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
        grenades: [], // this will hold all the grenade objects
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
    //console.log(lobbyId)
    //console.log(lobbies)
    //console.log(password)
    //console.log(lobbies[lobbyId].password)
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
                "position": {x: 5, y: 5, angle: 0}, lastMove: Date.now(), // for now the starting position is 5 5 later it will be changed, FIX THIS
                lastMouseMove: Date.now(), "ready": ready,"color":color, 
                interactCooldown: 0, health: 100,
                inventory: [null, null, null, null, null], selectedItemSlot: 0,
                stamina: 100, staminaRegenFunc: null, alive: true,
                punchCooldown: 0
            });
            ws.send(JSON.stringify({
                action: 'joined',
                isMain: isMain,
                uniqueID: uniqueID,
                color: color,
                lobbyId: lobbyId,
                lobbyPassword: lobbies[lobbyId].password || null,
                isPublic: lobbies[lobbyId].isPublic,
                map: lobbies[lobbyId].map
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
                    // starting the game loop
                    lobbies[lobbyId].mapInterval = setInterval(() => {
                        // sending the map data
                        lobbies[lobbyId].players.forEach(player => {
                            //console.log(getNearbyTiles(player, lobbies[lobbyId].map));
                            player.ws.send(JSON.stringify({ action: 'mapData', mapData: getNearbyTilesAndOtherInfo(player, lobbies[lobbyId].map, lobbies[lobbyId].players, lobbies[lobbyId].bullets, lobbies[lobbyId].grenades) }));
                        });
                        // updating the bullets
                        let bulletsToRemove = [];
                        lobbies[lobbyId].bullets.forEach((bullet, index) => {
                            bullet.traveledDistance += bullet.speed;
                            if (bullet.traveledDistance >= bullet.maxDistance) {
                                bulletsToRemove.push(index);
                            }
                        });
                        // removing the bullets
                        bulletsToRemove.forEach(index => {
                            clearInterval(lobbies[lobbyId].bullets[index].updateFunc);
                            lobbies[lobbyId].bullets.splice(index, 1);
                        });
                        // unaliving??? the players that are at 0 health
                        lobbies[lobbyId].players.forEach(p => {
                            if (p.health <= 0 && p.alive) {
                                p.alive = false;
                                p.ws.send(JSON.stringify({ action: 'playerDied' }));
                            }
                        });
                        // checking if the game is over(only one player is a alive and there were more than 1 player in the lobby)
                        let alivePlayers = lobbies[lobbyId].players.filter(p => p.alive);
                        if (alivePlayers.length <= 1 && lobbies[lobbyId].players.length > 1) {
                            lobbies[lobbyId].players.forEach(p => {
                                p.ws.send(JSON.stringify({ action: 'gameOver', winner: alivePlayers[0] ? alivePlayers[0].name : null }));
                            });
                            lobbies[lobbyId].hasStarted = false;
                            clearInterval(lobbies[lobbyId].mapInterval);
                            // resetting the players
                            lobbies[lobbyId].players.forEach(p => {
                                if(!p.isMain) p.ready = false;
                                p.alive = true;
                                p.health = 100;
                                p.position = {x: 5, y: 5, angle: 0};
                                p.stamina = 100;
                                if(p.staminaRegenFunc){
                                    clearInterval(p.staminaRegenFunc);
                                    p.staminaRegenFunc = null;
                                }
                            });
                            // sending the updated player list to all players in the lobby
                            lobbies[lobbyId].players.forEach(p => {
                                p.ws.send(JSON.stringify({
                                    action: 'lobbyInfo',
                                    thisPlayer: {
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
            if (lobbies[lobbyId].hasStarted === true && player && player.alive) {
                // moving the player based on the keys pressed
                if(player.lastMove + 10 < Date.now()){ // limiting the movement updates to 100 per second
                    player.lastMove = Date.now();
                    let speedMultiplier = speedModifierOfCurrentTile(player.position, lobbies[lobbyId].map);
                    function modifyKeysArray(keysArray){ // function that removes the keys that cancel each other out
                        let modified = keysArray;
                        if(keysArray.includes('a') && keysArray.includes("d")){
                            modified = modified.filter(key => key !== 'a' && key !== 'd');
                        }
                        if(keysArray.includes('w') && keysArray.includes("s")){
                            modified = modified.filter(key => key !== 'w' && key !== 's');
                        }
                        // removing all the keys that are not a, d, w, s or shift
                        modified = modified.filter(key => ['a', 'd', 'w', 's', 'shift'].includes(key));
                        return modified;
                    }
                    let keys = modifyKeysArray(data.keys);
                    let diagonal = 1;
                    if(keys.length > 1){
                        diagonal = Math.sqrt(2) / 2; // this is used to ensure that the player doesn't move faster when moving diagonally
                    }
                    //console.log(keys);
                    //console.log(speedMultiplier*diagonal);
                    //console.log(diagonal);
                    if(keys.includes('shift') && player.stamina > 0 && keys.length > 1){ // running if shift is held, "shift" has to be written in lowercase since its converted to lowercase on the client side
                        clearInterval(player.staminaRegenFunc);
                        player.staminaRegenFunc = null;
                        speedMultiplier *= 2;
                        player.stamina -= 0.5; // stamina is regenerating in the game loop by 0.25 every tick, and the loop runs 30 times a second
                        if(player.stamina < 0) player.stamina = 0;
                        player.ws.send(JSON.stringify({ action: 'staminaUpdate', stamina: Math.round(player.stamina) }));
                    }else if(player.stamina < 100 && !keys.includes('shift')){
                        if(!player.staminaRegenFunc){
                            player.staminaRegenFunc = setInterval(() => {
                                if(player.stamina < 100){
                                    player.stamina += 0.25;
                                    if(player.stamina > 100) player.stamina = 100;
                                    player.ws.send(JSON.stringify({ action: 'staminaUpdate', stamina: Math.round(player.stamina) }));
                                }else{
                                    clearInterval(player.staminaRegenFunc);
                                    player.staminaRegenFunc = null;
                                }
                            }, 1000 / 30); // 30 times a second
                        }
                    }
                    //console.log(speedMultiplier);
                    if(keys.includes('a')){
                        player.position.x -= 0.15 * speedMultiplier * diagonal;
                        if(!allowedPosition(player.position, lobbies[lobbyId].map, "left")) player.position.x += 0.15 * speedMultiplier * diagonal; //checking that the new position is allowed, meaning its not in a wall or outside of the map, if its not allowed then reversing the last movement
                    }

                    if(keys.includes('d')){
                        player.position.x += 0.15 * speedMultiplier * diagonal;
                        if(!allowedPosition(player.position, lobbies[lobbyId].map, "right")) player.position.x -= 0.15 * speedMultiplier * diagonal; // it is a bit dumb to have the two ifs like this but it is the fastest solution rn, I will change it later though
                    }

                    if(keys.includes('s')){
                        player.position.y += 0.15 * speedMultiplier * diagonal;
                        if(!allowedPosition(player.position, lobbies[lobbyId].map, "down")) player.position.y -= 0.15 * speedMultiplier * diagonal;
                    }

                    if(keys.includes('w')){
                        player.position.y -= 0.15 * speedMultiplier * diagonal;
                        if(!allowedPosition(player.position, lobbies[lobbyId].map, "up")) player.position.y += 0.15 * speedMultiplier * diagonal;
                    }

                    player.position.x = Math.round(player.position.x * 100) / 100;
                    player.position.y = Math.round(player.position.y * 100) / 100;
                    //console.log(player.position);
                    player.ws.send(JSON.stringify({ action: 'positionUpdate', position: player.position }));
                }
            }
        }else if(data.action === 'interact'){ // called when the player interacts with an item
            const lobbyId = ws.lobbyId;
            const player = lobbies[lobbyId].players.find(player => player.ws === ws);
            //console.log("interact");
            if (player && lobbies[lobbyId].hasStarted === true && player.interactCooldown + 200 < Date.now()) {
                let nearestItem = findNearestItem(player.position, lobbies[lobbyId].map.items);
                if (nearestItem && calcDistance(player.position, nearestItem.position) < 2) {
                    // removing the item from the map
                    lobbies[lobbyId].map.items = lobbies[lobbyId].map.items.filter(item => item !== nearestItem);
                    player.interactCooldown = Date.now();
                    // adding the item to the player's inventory if there is space
                    let added = false;
                    //console.log(nearestItem.ammo);
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
            if(lobbies[lobbyId].hasStarted === true && player && player.alive){
                if (player && player.lastMouseMove + 10 < Date.now()) { // limiting the mouse move updates to 100 per second
                    player.position.angle = Math.atan2(data.y - data.center.y, data.x - data.center.x);
                    player.ws.send(JSON.stringify({ action: 'positionUpdate', position: player.position }));
                    player.lastMouseMove = Date.now();
                }
            }
        }else if (data.action === 'leftClick'){ // called when the player wants to use the item in the selected slot
            const lobbyId = ws.lobbyId;
            const player = lobbies[lobbyId].players.find(player => player.ws === ws);
            if (player && lobbies[lobbyId].hasStarted === true && player.alive) {
                const slotIndex = player.selectedItemSlot;
                if (slotIndex >= 0 && slotIndex < player.inventory.length) {
                    const item = player.inventory[slotIndex];
                    if (item) {
                        // using the items, later on this will be dinamic and there will be ways to add custom items, for now its just medkit, pistol and grenade, FIX THIS
                        if(item){
                            //console.log(item.type);
                            switch(item.type){
                                case "health":
                                    if(player.health < 100){
                                        player.health += 25;
                                        if(player.health > 100) player.health = 100;
                                        player.ws.send(JSON.stringify({ action: 'healthUpdate', health: player.health }));
                                        // removing the medkit from the inventory
                                        player.inventory[slotIndex] = null;
                                        player.ws.send(JSON.stringify({ action: 'inventoryUpdate', inventory: player.inventory }));
                                    }
                                    break;
                                case "pistol":
                                    // shooting a bullet
                                    //console.log("fire");
                                    if(item.lastFired + 300 > Date.now()) return; // pistol can only be fired once every 300ms
                                    let uniqueID = player.id + "_" + Date.now();
                                    item.ammo -= 1;
                                    item.lastFired = Date.now();
                                    if(item.ammo < 0){
                                        // later this will trigger a text saying no ammo, FIX THIS
                                        //console.log("no ammo");
                                        item.ammo = 0;
                                        player.ws.send(JSON.stringify({ action: 'inventoryUpdate', inventory: player.inventory }));
                                        return;
                                    }
                                    player.ws.send(JSON.stringify({ action: 'inventoryUpdate', inventory: player.inventory }));
                                    lobbies[lobbyId].bullets.push({
                                        position: { x: player.position.x, y: player.position.y },
                                        angle: player.position.angle,
                                        shotBy: player.id,
                                        speed: 1,
                                        maxDistance: 30,
                                        uniqueID: uniqueID,
                                        bulletType: item.bulletType,
                                        updateFunc: setInterval((uniqueID) => {
                                            // updating the bullets position
                                            let bullet = lobbies[lobbyId].bullets.find(b => b.uniqueID === uniqueID);
                                            if (bullet) {
                                                bullet.position.x += Math.cos(bullet.angle) * bullet.speed;
                                                bullet.position.y += Math.sin(bullet.angle) * bullet.speed;
                                                let nearest = findNearestTile(bullet.position, lobbies[lobbyId].map.tiles);
                                                //console.log(nearest);
                                                let onTile = nearest.nearestTile;
                                                // checking if the bullet is inside a wall or outside of the map
                                                if (!onTile || onTile.type.walkable === false || bullet.position.x < 0.5 || bullet.position.x >= lobbies[lobbyId].map.gridSizeX - 0.5 || bullet.position.y < 0.5 || bullet.position.y >= lobbies[lobbyId].map.gridSizeY - 0.5) {
                                                    // removing the bullet
                                                    clearInterval(bullet.updateFunc);
                                                    lobbies[lobbyId].bullets = lobbies[lobbyId].bullets.filter(b => b.uniqueID !== uniqueID);
                                                    return;
                                                }
                                                // checking if the bullet hit a player
                                                lobbies[lobbyId].players.forEach(p => {
                                                    if (p.id !== bullet.shotBy) { // ensuring that the bullet doesn't hit the player that shot it
                                                        if (calcDistance(p.position, bullet.position) < 1) {
                                                            // bullet hit the player
                                                            p.health -= 20; // for now the pistol does 20 damage, later this will be dynamic based on the weapon, FIX THIS
                                                            if (p.health < 0) p.health = 0;
                                                            p.ws.send(JSON.stringify({ action: 'healthUpdate', health: p.health }));
                                                            // removing the bullet
                                                            clearInterval(bullet.updateFunc);
                                                            lobbies[lobbyId].bullets = lobbies[lobbyId].bullets.filter(b => b.uniqueID !== uniqueID);
                                                            return;
                                                        }
                                                    }
                                                });
                                            }
                                            //console.log("bullet updated");
                                        }, 1000 / 60, uniqueID) // 60 times a second
                                    });
                                    break;
                                case "grenade":
                                    // removing the grenade from the inventory
                                    player.inventory[slotIndex] = null;
                                    player.ws.send(JSON.stringify({ action: 'inventoryUpdate', inventory: player.inventory }));
                                    // throwing the grenade, basically starting a moving interval that moves the grenade forward and after 2 seconds it explodes dealing damage to all players in a certain radius
                                    const grenadeID = player.id + "_" + Date.now();
                                    const speed = 0.3; // grenade speed
                                    let grenadePosition = { x: player.position.x, y: player.position.y };
                                    let grenadeAngle = player.position.angle;
                                    console.log(lobbies[lobbyId]);
                                    lobbies[lobbyId].grenades.push({ position: grenadePosition, angle: grenadeAngle, uniqueID: grenadeID });
                                    let grenadeInterval = setInterval((grenadeID) => {
                                        let grenade = lobbies[lobbyId].grenades.find(g => g.uniqueID === grenadeID);
                                        if (grenade) {
                                            grenade.position.x += Math.cos(grenade.angle) * speed;
                                            grenade.position.y += Math.sin(grenade.angle) * speed;
                                            let nearest = findNearestTile(grenade.position, lobbies[lobbyId].map.tiles);
                                            let onTile = nearest.nearestTile;
                                            // checking if the grenade is inside a wall or outside of the map
                                            if (!onTile || onTile.type.walkable === false || grenade.position.x < 0.5 || grenade.position.x >= lobbies[lobbyId].map.gridSizeX - 0.5 || grenade.position.y < 0.5 || grenade.position.y >= lobbies[lobbyId].map.gridSizeY - 0.5) {
                                                // making the grenade explode
                                                grenade.position.x -= Math.cos(grenade.angle) * 0.3;
                                                grenade.position.y -= Math.sin(grenade.angle) * 0.3;
                                                clearInterval(grenadeInterval);
                                                lobbies[lobbyId].grenades = lobbies[lobbyId].grenades.filter(g => g.uniqueID !== grenadeID);
                                                // dealing damage to all players in a radius
                                                const radius = 5;
                                                let nearbyPlayers = findNearestPlayers(grenade.position, lobbies[lobbyId].players);
                                                nearbyPlayers.forEach(player => {
                                                    if (calcDistance(grenade.position, player.position) < radius) {
                                                        player.health -= 50; // dealing 50 damage
                                                        if (player.health < 0) player.health = 0;
                                                        player.ws.send(JSON.stringify({ action: 'healthUpdate', health: player.health }));
                                                    }
                                                });
                                                return;
                                            }
                                        }
                                    }, 1000 / 60, grenadeID); // 60 times a second
                                    break;
                                default:
                                    break;
                            }
                        }
                    }else if (player.punchCooldown < Date.now() + 400) { // punching someone if they are near enough
                        let nearestPlayer = findNearestPlayers(player, lobbies[lobbyId].players)[0]; // finding the nearest player
                        if (nearestPlayer && calcDistance(player.position, nearestPlayer.position) < 2) {
                            nearestPlayer.health -= 10; // punching does 10 damage
                            if (nearestPlayer.health < 0) nearestPlayer.health = 0;
                            nearestPlayer.ws.send(JSON.stringify({ action: 'healthUpdate', health: nearestPlayer.health }));
                            player.punchCooldown = Date.now();
                        }    
                    }
                }
            }
        }else if (data.action === "dropItem"){ // called when the player wants to drop an item
            const lobbyId = ws.lobbyId;
            const player = lobbies[lobbyId].players.find(player => player.ws === ws);
            if (player && lobbies[lobbyId].hasStarted === true) {
                const slotIndex = data.selectedItemSlot;
                if (slotIndex >= 0 && slotIndex < player.inventory.length) {
                    const item = player.inventory[slotIndex];
                    if (item) {
                        // calculating offsets so that the item drops in front of the player
                        let offsetX = Math.cos(player.position.angle) * 1.5;
                        let offsetY = Math.sin(player.position.angle) * 1.5;
                        // checking if the drop position is valid and not inside a wall or outside of the map
                        let itemDropPositionTile = findNearestTile({x: player.position.x + offsetX, y: player.position.y + offsetY}, lobbies[lobbyId].map.tiles).nearestTile;
                        // checking if the item drop position is walkable, if not then dropping the item at the player's position
                        if (!itemDropPositionTile || !itemDropPositionTile.type.walkable) {
                            offsetX = 0;
                            offsetY = 0;
                            //console.log("not walkable");
                        }
                        // checking if the item drop position is outside of the map boundaries, if so then dropping the item at the player's position
                        if (player.position.x + offsetX < 0.5 || player.position.x + offsetX >= lobbies[lobbyId].map.gridSizeX - 0.5 || player.position.y + offsetY < 0.5 || player.position.y + offsetY >= lobbies[lobbyId].map.gridSizeY - 0.5) {
                            offsetX = 0;
                            offsetY = 0;
                            //console.log("out of bounds");
                        }
                        // dropping the item on the ground
                        lobbies[lobbyId].map.items.push({ position: { x: player.position.x + offsetX, y: player.position.y + offsetY }, color: item.color, type: item.type, ammo: item.ammo, bulletType: item.bulletType || null });
                        // removing the item from the player's inventory
                        player.inventory[slotIndex] = null;
                        player.ws.send(JSON.stringify({ action: 'inventoryUpdate', inventory: player.inventory }));
                    }
                }
            }
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