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
let position = { x: 0, y: 0, angle: 0 };
let tileSize; // this is the size of each tile of the map, it is changing based on the browser windows size
let playerColor = { r: 255, g: 255, b: 255 };
let playerHealth = 100;
let selectedItemSlot = 0; // the currently selected item slot, it is from 0 to 4
let inventory = [null, null, null, null, null]; // this will hold the items that the player has picked up

socket.addEventListener('open', () => {
    // sending the join action to the server
    const lobbyId = window.location.pathname.split('/').pop();
    const playerName = new URLSearchParams(window.location.search).get('username') || 'Anonymous';
    const securityString = new URLSearchParams(window.location.search).get('securityString') || '';
    socket.send(JSON.stringify({ action: 'join', lobbyId, playerName, securityString }));
});

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.action === 'joined') { // received when the player joins the lobby
        // setting the information in the lobby modal
        document.getElementById('lobbyID').value = `${data.lobbyId}`;
        document.getElementById('lobbyPassword').value = `${data.lobbyPassword || 'None'}`;
        if(data.isPublic){
            document.getElementById('btnradio2').checked = true;
        } else {
            document.getElementById('btnradio3').checked = true;
        }
        playerColor = data.color;
    } else if (data.action === 'newMain') { // happens when the main player leaves and a new main player is selected
        console.log('You are now the main player');
    }else if (data.action === 'error'){ // error handling
        if(data.fatal){
            window.location.href = '/?error=' + encodeURIComponent(data.message);
        }else{
            alert(`${data.message}`);
        }
    }else if (data.action === 'gameStarted'){ // this is received when the game is started
        // closing the modal
        lobbyModal.hide();
        // updating the angle of the player, this makes the transition from lobby modal to game smoother
        //console.log("Game started");
        socket.send(JSON.stringify({ action: 'mouseMove', x: mouseX, y: mouseY, center: { x: windowWidth / 2, y: windowHeight / 2 } }));
    }else if (data.action === 'lobbyInfo'){ // this is received every time a new player joins the lobby
        const playersList = document.getElementById("playerList");
        const thisPlayer = data.thisPlayer
        playersList.innerHTML = '';
        document.getElementById('lobbyStatus').textContent = `Players: ${data.players.length}/100`;
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
        //console.log("Map data received from server:");
        //console.log(mapData);
    }else if (data.action === "mapVerificationResult"){ // result of the map verification
        if(!data.valid){
            alert(data.errorMessage);
        }
    }else if (data.action === "mapSelected"){
        document.getElementById('currentMapName').textContent = data.name;
        closeSelectMapsModal();
    }else if(data.action === "positionUpdate"){
        position = data.position;
        //console.log(position);
    }else if(data.action === "healthUpdate"){
        playerHealth = data.health;
    }else if(data.action === "itemSlotChange"){
        selectedItemSlot = data.selectedItemSlot;
    }else if(data.action === "inventoryUpdate"){
        inventory = data.inventory;
    }
});

function distance(pos1, pos2){ // function to calculate the distance between two positions
    return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2);
}

function requestGameStart(){ // function to request the game start
    const lobbyId = window.location.pathname.split('/').pop();
    socket.send(JSON.stringify({ action: 'startGame', lobbyId }));
}

function requestChangeReadyState(playerId){ // function to change the ready state of the player
    const isReady = document.getElementById(`readySwitch-${playerId}`).checked;
    socket.send(JSON.stringify({ action: 'readyUPchange', isReady: isReady }));
}

function requestVisibilityChange(){ // function for requesting the server to change the visibility of the lobby
    const lobbyId = window.location.pathname.split('/').pop();
    const btnradio1 = document.getElementById('btnradio2');
    const btnradio2 = document.getElementById('btnradio3');
    const visibility = btnradio1.checked ? true : false;
    if(btnradio1.checked){ // the radio button that was clicked has to be unchecked otherwise it will create visual problems when a non-main player tries to change the visibility
        btnradio2.checked = true;
        btnradio1.checked = false;
    }else{
        btnradio2.checked = false;
        btnradio1.checked = true;
    }
    socket.send(JSON.stringify({ action: 'changeLobbyVisibility', visibility: visibility, lobbyId: lobbyId }));
}

function importJson(type) {
    let jsonData;
    if (type === 'file') {
        const fileInput = document.getElementById('importJsonFileInput');
        const file = fileInput.files[0];
        if (!file) {
            alert('Please select a file to import.');
            return;
        }
        if (file.type !== 'application/json') {
            alert('Please select a valid JSON file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                jsonData = JSON.parse(event.target.result);
                //console.log(jsonData)
                socket.send(JSON.stringify({ action: 'loadMap', mapData: jsonData }));
            } catch (error) {
                alert('Error parsing JSON: ' + error.message);
            }
        };
        reader.readAsText(file);
    } else if (type === 'text') {
        const textArea = document.getElementById('importJsonTextArea');
        try {
            jsonData = JSON.parse(textArea.value);
            socket.send(JSON.stringify({ action: 'loadMap', mapData: jsonData }));
        } catch (error) {
            alert('Error parsing JSON: ' + error.message);
        }
    }
}

function loadLocalStorageMaps(){ // function to load the maps from local storage and display them in the maps select modal
    const localStorageMapsList = document.getElementById('localStorageMapsList');
    localStorageMapsList.innerHTML = '';
    const maps = localStorage.getItem('maps') ? JSON.parse(localStorage.getItem('maps')) : [];
    maps.forEach(map => {
        const listItem = document.createElement('list-item');
        listItem.className = 'list-group-item';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(map.name));
        const loadButton = document.createElement('button');
        loadButton.className = 'btn btn-primary float-end';
        loadButton.textContent = 'Load';
        loadButton.onclick = () => {
            socket.send(JSON.stringify({ action: 'loadMap', mapData: map }));
        };
        div.appendChild(loadButton);
        listItem.appendChild(div);
        localStorageMapsList.appendChild(listItem);
    });
}

const mapSelectModal = new bootstrap.Modal(document.getElementById('selectMapsModal'));
function openMapsSelectModal(){ // function to open the map selection modal
    loadLocalStorageMaps();
    lobbyModal.hide();
    mapSelectModal.show();
}
function closeSelectMapsModal(){ // function to close the map selection modal
    lobbyModal.show();
    mapSelectModal.hide();
}

function copyLobbyPassword(){ // function to copy the lobby password to the clipboard, it is called in the lobby modal
    const lobbyPassword = document.getElementById('lobbyPassword').value
    navigator.clipboard.writeText(lobbyPassword).then(() => {
        alert('Lobby password copied to clipboard!');
    }).catch(err => {
        alert('Failed to copy lobby password. Please try again.');
    });
}

function copyLobbyID(){ // function to copy the lobby ID to the clipboard, it is called in the lobby modal
    const lobbyID = document.getElementById('lobbyID').value
    navigator.clipboard.writeText(lobbyID).then(() => {
        alert('Lobby ID copied to clipboard!');
    }).catch(err => {
        alert('Failed to copy lobby ID. Please try again.');
    });
}

let keysPressed = {}; // object to hold the keys that are currently pressed
// starting the controls to request movement from the server
document.addEventListener('keydown', (event) => {
    keysPressed[event.key] = true;
});
document.addEventListener('keyup', (event) => {
    keysPressed[event.key] = false;
});
// click is fire
document.addEventListener('click', (event) => {
    socket.send(JSON.stringify({ action: 'click', x: event.clientX, y: event.clientY }));
});
// sending the movements to the server
setInterval(() => {
    if (Object.keys(keysPressed).length > 0 && Object.values(keysPressed).includes(true)) {
        let keys = [];
        for (let key in keysPressed) {
            if (keysPressed[key]) { // if the key is pressed
                keys.push(key); // add the key to the array
            }
        }
        if (keys) {
            socket.send(JSON.stringify({ action: 'keys', keys: keys}));
        }
    }
}, 1000 / 100);

// sending the position of the mouse for aiming
document.addEventListener('mousemove', (event) => {
    if(socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: 'mouseMove', x: event.clientX, y: event.clientY, center: { x: windowWidth / 2, y: windowHeight / 2 } }));
    }
});

document.addEventListener('keydown', (event) => {
    // adding a listener for the e key to interact with items, this has to be separate from the other keys to make sure that the player cannot just hold the e key to sweep items
    // now that I think of it the player could just change this code, however it doesnt really matter since sweeping the items is not game breaking
    if (event.key === 'e') {
        socket.send(JSON.stringify({ action: 'interact' }));
    }
    if (event.key >= '1' && event.key <= '5') { // selecting the item slots with number keys 1 to 5
        selectedItemSlot = parseInt(event.key) - 1;
        socket.send(JSON.stringify({ action: 'selectItemSlot', selectedItemSlot: selectedItemSlot }));
    }
});

/*
let zoomLevel = 1; // variable to hold the zoom level, all of this is just for testing
document.addEventListener('wheel', (event) => { // event listener for zooming in and out with the mouse wheel
    if (event.deltaY < 0) {
        zoomLevel += 0.1;
    } else {
        zoomLevel -= 0.1;
    }
});*/

function drawMap(){ // function for drawing the map
    if(!mapData) return; // if there is no map data
    tileSize = windowWidth > windowHeight ? windowHeight / 20 : windowWidth / 20; // setting the tile size based on the bigger dimension
    //if(!test) return;
    //console.log(mapData.gridSizeX, mapData.gridSizeY);
    push();
    noStroke();
    translate(windowWidth / 2, windowHeight / 2);
    //scale(zoomLevel);
    //console.log("Zoom level:", zoomLevel);
    mapData.tiles.forEach((element) => {
        fill(element.type.color);
        rect(element.x * tileSize - position.x * tileSize, element.y * tileSize - position.y * tileSize, tileSize + 1, tileSize + 1); // +1 is to avoid gaps between tiles
        //console.log("Drawing tile at:", element.x, element.y, "Type:", element.type.name);
    });
    pop();
}

function drawPlayers(){ // draws the players on their x and y positions that are stored on the server
    if(!mapData) return;
    mapData.nearbyPlayers.forEach((player) => {
        push();
        translate(windowWidth / 2 - position.x * tileSize, windowHeight / 2 - position.y * tileSize);
        fill(player.color.r, player.color.g, player.color.b);
        ellipse(player.position.x * tileSize, player.position.y * tileSize, tileSize * 0.8, tileSize * 0.8);
        stroke(255, 0, 0);
        line(player.position.x * tileSize, player.position.y * tileSize, player.position.x * tileSize + cos(player.position.angle) * tileSize * 0.8, player.position.y * tileSize + sin(player.position.angle) * tileSize * 0.8);
        pop();
    });
}

function drawUI(){ // draws the score board and other elements
    push();
    // drawing the position of the player on the top left of the screen
    fill(0);
    textSize(16);
    textAlign(LEFT, TOP);
    text(`Position: X= ${position.x.toFixed(2)}, Y= ${position.y.toFixed(2)}, Angle= ${(Math.round(position.angle * 100)/100).toFixed(2)}`, 10, 10);
    // drawing the health of the player on the bottom left of the screen
    textAlign(LEFT, BOTTOM);
    text(`Health: ${playerHealth}`, 10, windowHeight - 10);
    // drawing the inventory squares of the player on the bottom center
    for(let i = -2; i <= 2; i++){
        stroke(255);
        noFill();
        rect(windowWidth / 2 + i * (tileSize + 5) - (tileSize + 5) / 2, windowHeight - tileSize - 10, tileSize, tileSize);
        if(i + 2 === selectedItemSlot){ // highlighting the selected item slot
            noFill();
            stroke(255, 255, 0);
            rect(windowWidth / 2 + i * (tileSize + 5) - (tileSize + 5) / 2 - 2, windowHeight - tileSize - 10 - 2, tileSize + 4, tileSize + 4);
        }
        // drawing the item in the slot if there is one
        if(inventory[i + 2]){
            noStroke();
            fill(inventory[i + 2].color.r, inventory[i + 2].color.g, inventory[i + 2].color.b);
            ellipse(windowWidth / 2 + i * (tileSize + 5) - 2, windowHeight - tileSize / 2 - 10, tileSize * 0.6, tileSize * 0.6);
            fill(255);
            textAlign(CENTER, CENTER);
            textSize(12);
            text(inventory[i + 2].name, windowWidth / 2 + i * (tileSize + 5), windowHeight - tileSize / 2 - 10 + tileSize / 2 + 10);
        }
    }
    pop();
}

//let test = true
function drawItems(){ // draws the items that are on the map
    if(!mapData) return;
    //if(test){
    //    console.log(mapData);
    //    test = false;
    //}
    let nearestItem = null;
    let minDistance = Infinity;
    mapData.items.forEach((item) => {
        push();
        translate(windowWidth / 2 - position.x * tileSize, windowHeight / 2 - position.y * tileSize);
        fill(item.color.r, item.color.g, item.color.b);
        ellipse(item.position.x * tileSize, item.position.y * tileSize, tileSize * 0.5, tileSize * 0.5);
        pop();
        if(distance(position, item.position) < minDistance){ // finding the nearest item to the player
            minDistance = distance(position, item.position);
            nearestItem = item;
        }
    });
    if(nearestItem && distance(position, nearestItem.position) < 1.5){ // if the player is close enough then drawing a circle with the letter E, this doesnt affect the players ability to interact with the item
        push();
        translate(windowWidth / 2 - position.x * tileSize, windowHeight / 2 - position.y * tileSize);
        noFill();
        stroke(255, 255, 0);
        ellipse(nearestItem.position.x * tileSize, nearestItem.position.y * tileSize, tileSize * 0.6, tileSize * 0.6);
        fill(255, 255, 0);
        textSize(16);
        textAlign(CENTER, CENTER);
        text("E", nearestItem.position.x * tileSize, nearestItem.position.y * tileSize);
        pop();
    }
}

function drawSelf(){ // draws the player in the center of the screen and later it will draw whatever he holds
    // drawing the player
    push();
    fill(playerColor.r, playerColor.g, playerColor.b);
    ellipse(windowWidth / 2, windowHeight / 2, tileSize * 0.8, tileSize * 0.8);
    // drawing a line to indicate the direction the player is facing
    stroke(255, 0, 0);
    line(windowWidth / 2, windowHeight / 2, windowWidth / 2 + cos(position.angle) * tileSize * 0.8, windowHeight / 2 + sin(position.angle) * tileSize * 0.8);
    pop();
}

function setup(){ // this function is automatically called once by p5.js
    let canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent("gameCanvas")
}

function draw(){ // this function is automatically called by p5.js, it is used for drawing on the canvas
    background(0, 0, 255);
    drawMap();
    drawItems();
    drawPlayers();
    drawSelf();
    drawUI();
}