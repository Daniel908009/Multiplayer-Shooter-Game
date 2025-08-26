// MODAL CODE
const modalElement = document.getElementById('lobbyModal');
const lobbyModal = new bootstrap.Modal(modalElement);
// Showing the modal when the page loads
document.addEventListener('DOMContentLoaded', () => {
  lobbyModal.show();
});

// Global variables
const socket = new WebSocket(`ws://${location.host}`);
let mapData = null; // this will hold the map data when it is received from the server, modifying it here will not help the client in any way since all the logic is on the server side

socket.addEventListener('open', () => {
    // sending the join action to the server
    const lobbyId = window.location.pathname.split('/').pop();
    const playerName = new URLSearchParams(window.location.search).get('username') || 'Anonymous';
    socket.send(JSON.stringify({ action: 'join', lobbyId, playerName }));
});

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.action === 'joined') { // received when the player joins the lobby
        // setting the information in the lobby modal
        document.getElementById('btnradio').checked = true;
        document.getElementById('lobbyID').textContent = `${data.lobbyId}`;
        document.getElementById('lobbyPassword').textContent = `${data.lobbyPassword || 'None'}`;
        if(data.isPublic){
            document.getElementById('btnradio2').checked = true;
        } else {
            document.getElementById('btnradio3').checked = true;
        }
    } else if (data.action === 'newMain') { // happens when the main player leaves and a new main player is selected
        console.log('You are now the main player');
    }else if (data.action === 'error'){ // error handling
        alert(`${data.message}`);
    }else if (data.action === 'gameStarted'){ // this is received when the game is started
        // closing the modal
        lobbyModal.hide();
        if(data.isMain){
            socket.send(JSON.stringify({ action: 'requestMap' })); // requesting a random map from the server, later it will have some options and conditions
        }
        startControls()
    }else if (data.action === 'lobbyInfo'){ // this is received every time a new player joins the lobby
        const playersList = document.getElementById("playerList");
        const thisPlayer = data.thisPlayer
        playersList.innerHTML = '';
        data.players.forEach(player => {
            const div = document.createElement('div');
            div.classList.add("locked-row-container")
            const playerItem = document.createElement('li');
            playerItem.textContent = `${player.name} ${player.isMain ? '👑' : ''}`
            div.appendChild(playerItem);
            const switchButton = document.createElement('div');
            switchButton.className = 'form-check form-switch';
            if(player.id === thisPlayer.id && !thisPlayer.isMain){
                switchButton.innerHTML = `
                    <input class="form-check-input" type="checkbox" id="readySwitch-${player.id}" onchange="requestChangeReadyState(${player.id})" ${thisPlayer.ready ? 'checked' : ''}>`;
            }else{
                switchButton.innerHTML = `
                    <input class="form-check-input" type="checkbox" id="readySwitch-${player.id}" disabled ${player.ready ? 'checked' : ''}> `;
            }
            switchButton.innerHTML += `<label class="form-check-label" for="readySwitch-${player.id}">Ready</label>`;
            div.appendChild(switchButton);
            playersList.appendChild(div);
        });
    }else if (data.action === "statusChange"){ // called when the main player changed the status of the lobby and the server sent all the players updated info
        //console.log('Status changed:', data.isOpen);
        const isOpen = data.isOpen;
        if( isOpen){
            document.getElementById('btnradio').checked = true;
            document.getElementById('btnradio1').checked = false;
        }else{
            document.getElementById('btnradio').checked = false;
            document.getElementById('btnradio1').checked = true;
        }
    }else if (data.action === "visibilityChange"){ // called by the server when the main player changed the visibility of the lobby
        const isPublic = data.isPublic;
        if(isPublic){
            document.getElementById('btnradio2').checked = true;
            document.getElementById('btnradio3').checked = false;
        } else {
            document.getElementById('btnradio2').checked = false;
            document.getElementById('btnradio3').checked = true;
        }
    }else if (data.action === "mapData"){
        mapData = data.mapData;
        mapData.players = data.players; // adding the players to the map data so that they can be drawn on the map
    }
});

function requestGameStart(){ // function to request the game start
    const lobbyId = window.location.pathname.split('/').pop();
    socket.send(JSON.stringify({ action: 'startGame', lobbyId }));
}

function requestChangeReadyState(playerId){ // function to change the ready state of the player
    const isReady = document.getElementById(`readySwitch-${playerId}`).checked;
    socket.send(JSON.stringify({ action: 'readyUPchange', isReady: isReady }));
}

function requestVisibilityChange(visibility){ // function for requesting the server to change the visibility of the lobby
    const lobbyId = window.location.pathname.split('/').pop();
    socket.send(JSON.stringify({ action: 'changeLobbyVisibility', visibility: visibility, lobbyId: lobbyId }));
}

function copyLobbyPassword(){ // function to copy the lobby password to the clipboard, it is called in the lobby modal
    const lobbyPassword = document.getElementById('lobbyPassword').textContent
    navigator.clipboard.writeText(lobbyPassword).then(() => {
        alert('Lobby password copied to clipboard!');
    }).catch(err => {
        alert('Failed to copy lobby password. Please try again.');
    });
}

function copyLobbyID(){ // function to copy the lobby ID to the clipboard, it is called in the lobby modal
    const lobbyID = document.getElementById('lobbyID').textContent
    navigator.clipboard.writeText(lobbyID).then(() => {
        alert('Lobby ID copied to clipboard!');
    }).catch(err => {
        alert('Failed to copy lobby ID. Please try again.');
    });
}

let keysPressed = {}; // object to hold the keys that are currently pressed

function startControls(){ // starts the controls to request movement from the server
    document.addEventListener('keydown', (event) => {
        keysPressed[event.key] = true;
    });
    document.addEventListener('keyup', (event) => {
        keysPressed[event.key] = false;
    });
    // sending the position of the mouse for aiming
    document.addEventListener('mousemove', (event) => {
        socket.send(JSON.stringify({ action: 'mouseMove', x: event.clientX, y: event.clientY, tileSize: windowWidth > windowHeight ? windowHeight / 20 : windowWidth / 20 }));
    });
    // click is fire
    document.addEventListener('click', (event) => {
        socket.send(JSON.stringify({ action: 'click', x: event.clientX, y: event.clientY }));
    });
    // sending the movements to the server
    setInterval(() => {
        if (Object.keys(keysPressed).length > 0) { // if any key is pressed
            let keys = [];
            for (let key in keysPressed) {
                if (keysPressed[key]) { // if the key is pressed
                    keys.push(key); // add the key to the array
                }
            }
            if (keys) {
                socket.send(JSON.stringify({ action: 'move', keys: keys , tileSize: windowWidth > windowHeight ? windowHeight / 20 : windowWidth / 20 }));
            }
        }
    }, 1000 / 100);
}

function drawMap(){ // function for drawing the map that is currently loaded
    // used for scaling
    let baseSize = windowWidth > windowHeight ? windowHeight : windowWidth;
    let tileSize = baseSize / 20;
    // drawing the map
    if (mapData) {
        // drawing each of the tiles
        for (let tileType in mapData.tiles) {
            mapData.tiles[tileType].forEach(tile => {
                //console.log("here", tileType, tile);
                if(tileType === 'walls'){
                    fill(100, 100, 100);
                }else if(tileType === 'spikes'){
                    fill(255, 0, 0);
                }
                rect(tile.x*tileSize, tile.y*tileSize, tileSize, tileSize);
            });
        }
    }
}

function drawPlayers(){ // draws the players on their x and y positions that are stored on the server
    if (mapData){
        mapData.players.forEach(player =>{
            fill(player.color.r, player.color.g, player.color.b);
            let tileSize = windowWidth > windowHeight ? windowHeight / 20 : windowWidth / 20;
            let xPosition = player.position.x * tileSize + tileSize / 2;
            let yPosition = player.position.y * tileSize + tileSize / 2;
            ellipse(xPosition, yPosition, tileSize*0.8, tileSize*0.8);
            // drawing the angle of the player as a line
            stroke(0);
            let angle = player.position.angle;
            let lineLength = tileSize / 1.5;
            let endX = xPosition + lineLength * Math.cos(angle);
            let endY = yPosition + lineLength * Math.sin(angle);
            line(xPosition, yPosition, endX, endY);
        })
    }
}

function drawUI(){ // draws the score board and other elements

}

function setup(){ // this function is automatically called once by p5.js
    let canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent("gameCanvas")
}

function draw(){ // this function is automatically called by p5.js, it is used for drawing on the canvas
    background(255, 255, 255);
    drawMap();
    drawPlayers();
    drawUI();
}