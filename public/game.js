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
    console.log('Connected to the server');
    // sending the join action to the server
    const lobbyId = window.location.pathname.split('/').pop();
    const playerName = new URLSearchParams(window.location.search).get('username') || 'Anonymous';
    socket.send(JSON.stringify({ action: 'join', lobbyId, playerName }));
});

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.action === 'joined') { // received when the player joins the lobby
        console.log(`Joined lobby as ${data.isMain ? 'main' : 'secondary'} player with ID: ${data.uniqueID}`);
    } else if (data.action === 'newMain') { // happens when the main player leaves and a new main player is selected
        console.log('You are now the main player');
    }else if (data.action === 'error'){ // error handling
        alert(`${data.message}`);
    }else if (data.action === 'gameStarted'){ // this is received when the game is started
        // closing the modal
        lobbyModal.hide();
        console.log('Game started');
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
            const playerItem = document.createElement('li');
            playerItem.textContent = `${player.name} ${player.isMain ? '(Main Player)' : '(Secondary Player)'}`;
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
    }else if (data.action === "mapData"){
        mapData = data.mapData;
        console.log('Map data received:', mapData);
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

function startControls(){ // starts the controls to request movement from the server
    document.addEventListener('keydown', (event) => {
        // all the movement keys
        if (event.key === 'ArrowUp') {
            socket.send(JSON.stringify({ action: 'move', direction: 'up' }));
        } else if (event.key === 'ArrowDown') {
            socket.send(JSON.stringify({ action: 'move', direction: 'down' }));
        } else if (event.key === 'ArrowLeft') {
            socket.send(JSON.stringify({ action: 'move', direction: 'left' }));
        } else if (event.key === 'ArrowRight') {
            socket.send(JSON.stringify({ action: 'move', direction: 'right' }));
        }
    });
    // sending the position of the mouse for aiming
    document.addEventListener('mousemove', (event) => {
        socket.send(JSON.stringify({ action: 'mouseMove', x: event.clientX, y: event.clientY }));
    });
    // click is fire
    document.addEventListener('click', (event) => {
        socket.send(JSON.stringify({ action: 'click', x: event.clientX, y: event.clientY }));
    });
}

function drawMap(){ // function for drawing the map that is currently loaded
    //console.log(mapData);
    // used for scaling
    let baseSize = windowWidth > windowHeight ? windowHeight : windowWidth;
    let tileSize = baseSize / 20;
    // drawing the map
    if (mapData) {
        // drawing each of the tiles
        for (let tileType in mapData.tiles) {
            mapData.tiles[tileType].forEach(tile => {
                //console.log("here", tileType, tile);
                fill(0, 0, 0); // default color for tiles
                rect(tile.x, 0, tileSize, tileSize);
                console.log(tile.x, tile.y, tileSize, tileSize);
            });
        }
    }
}

function drawPlayers(){ // draws the players on their x and y positions that are stored on the server
    
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