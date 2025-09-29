// MODAL CODE
const modalElement = document.getElementById('lobbyModal');
const lobbyModal = new bootstrap.Modal(modalElement);
// Showing the modal when the page loads
document.addEventListener('DOMContentLoaded', () => {
  lobbyModal.show();
});
// resizing doesnt work, DO THIS
// resizing the canvas when the window is resized
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    tileSize = windowWidth > windowHeight ? windowHeight / 20 : windowWidth / 20; // setting the tile size based on the bigger dimension
    //console.log(windowWidth, windowHeight, tileSize);
}
window.addEventListener('resize', windowResized);
window.addEventListener('fullscreenchange', windowResized);

// Global variables
const socket = new WebSocket(`ws://${location.host}`);
let mapData = null; // this will hold the map data when it is received from the server, modifying it here will not help the client in any way since all the logic is on the server side
let position = { x: 0, y: 0, angle: 0 };
let tileSize; // this is the size of each tile of the map, it is changing based on the browser windows size
let playerColor = { r: 255, g: 255, b: 255 };
let playerHealth = 100;
let playerStamina = 100;
let selectedItemSlot = 0; // the currently selected item slot, it is from 0 to 4
let inventory = [null, null, null, null, null]; // this will hold the items that the player has picked up
let images = {}; // this will hold the images of items and other things
let bulletImages = {}; // this will hold the images of bullets

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
        document.getElementById('currentMapName').textContent = data.map ? data.map.name : "No map selected";
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
    }else if(data.action === "staminaUpdate"){
        playerStamina = data.stamina;
    }else if(data.action === "itemSlotChange"){
        selectedItemSlot = data.selectedItemSlot;
    }else if(data.action === "inventoryUpdate"){
        inventory = data.inventory;
    }else if (data.action === "playerDied"){
        alert("You have died! There is no spectating or respawning so enjoy this alert."); // FIX THIS, add spectating
    }else if (data.action === "gameOver"){
        alert(data.winner ? `Game over! The winner is ${data.winner}` : "Game over! There is no winner.");
        lobbyModal.show();
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
    let key = event.key.toLowerCase();
    //console.log(key);
    keysPressed[key] = true;
});
document.addEventListener('keyup', (event) => {
    let key = event.key.toLowerCase();
    keysPressed[key] = false;
});
// clicking the mouse to use the item in the selected slot
document.addEventListener('mousedown', (event) => {
    if(event.button !== 0) return;
    socket.send(JSON.stringify({ action: 'leftClick', x: event.clientX, y: event.clientY }));
});
document.addEventListener('contextmenu', (event) => { // right click is for dropping the item currently in the selected slot
    event.preventDefault();
    socket.send(JSON.stringify({ action: 'dropItem', x: event.clientX, y: event.clientY, selectedItemSlot: selectedItemSlot }));
});
// sending the movements to the server
setInterval(() => {
    let keys = [];
    for (let key in keysPressed) {
        if (keysPressed[key]) { // if the key is pressed
            keys.push(key); // add the key to the array
        }
    }
    if(WebSocket.OPEN !== socket.readyState) return; // if the socket is not open then do nothing
    socket.send(JSON.stringify({ action: 'keys', keys: keys}));
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

document.addEventListener('wheel', (event) => { // event listener for changing the selected item slot with the mouse wheel
    if (event.deltaY < 0) { // scrolling up
        selectedItemSlot = (selectedItemSlot + 4) % 5; // going to the previous slot, wrapping around
    } else if (event.deltaY > 0) { // scrolling down
        selectedItemSlot = (selectedItemSlot + 1) % 5; // going to the next slot, wrapping around
    }
    socket.send(JSON.stringify({ action: 'selectItemSlot', selectedItemSlot: selectedItemSlot }) ); // sending the selected item slot to the server
});

function drawMap(){ // function for drawing the map
    if(!mapData) return; // if there is no map data
    //if(!test) return;
    //console.log(mapData.gridSizeX, mapData.gridSizeY);
    push();
    noStroke();
    translate(windowWidth / 2, windowHeight / 2);
    let scaleX = windowWidth / (40 * tileSize); // the 40 is the vision range of the player that is set on the server
    let scaleY = windowHeight / (40 * tileSize);
    let scaleFactor = Math.min(scaleX, scaleY, 1);
    scale(scaleFactor);
    // drawing the tiles within the players view distance
    mapData.tiles.forEach((element) => {
        //console.log(tileSize)
        fill(element.type.color);
        rect(element.x * tileSize - position.x * tileSize, element.y * tileSize - position.y * tileSize, tileSize + 1, tileSize + 1); // +1 is to avoid gaps between tiles
        //rect(element.x * tileSize - position.x * tileSize, element.y * tileSize - position.y * tileSize, tileSize + 1, tileSize + 1); // +1 is to avoid gaps between tiles
        //console.log("Drawing tile at:", element.x, element.y, "Type:", element.type.name);
    });
    // drawing the darker tiles that are further away
    //console.log(mapData.darkTiles);
    mapData.darkTiles.forEach((element) => {
        let c = element.type.color;
        //fill(0)
        //rect(element.x * tileSize - position.x * tileSize, element.y * tileSize - position.y * tileSize, tileSize + 1, tileSize + 1);
        //console.log(color);
        let darkenedColor = color(red(c) * 0.3, green(c) * 0.3, blue(c) * 0.3);
        fill(darkenedColor);
        rect(element.x * tileSize - position.x * tileSize, element.y * tileSize - position.y * tileSize, tileSize + 1, tileSize + 1);
    });
    // drawing the border lines of the map
    stroke(0);
    strokeWeight(4);
    stroke(255, 0, 0);
    noFill();
    rect(-position.x * tileSize, -position.y * tileSize, mapData.gridSizeX * tileSize, mapData.gridSizeY * tileSize);
    pop();
}

function drawPlayers(){ // draws the players on their x and y positions that are stored on the server
    if(!mapData) return;
    mapData.nearbyPlayers.forEach((player) => {
        push();
        translate(windowWidth / 2, windowHeight / 2);
        let scaleX = windowWidth / (40 * tileSize);
        let scaleY = windowHeight / (40 * tileSize);
        let scaleFactor = Math.min(scaleX, scaleY, 1);
        scale(scaleFactor);
        // drawing the player
        fill(player.color.r, player.color.g, player.color.b);
        ellipse(player.position.x * tileSize - position.x * tileSize, player.position.y * tileSize - position.y * tileSize, (tileSize * 0.9) / scaleFactor, (tileSize * 0.9) / scaleFactor);
        // drawing a line to indicate the direction the player is facing
        stroke(255, 0, 0);
        line(player.position.x * tileSize - position.x * tileSize, player.position.y * tileSize - position.y * tileSize, player.position.x * tileSize - position.x * tileSize + cos(player.position.angle) * (tileSize * 0.8) / scaleFactor, player.position.y * tileSize - position.y * tileSize + sin(player.position.angle) * (tileSize * 0.8) / scaleFactor);
        // drawing the name of the player above
        noStroke();
        fill(255);
        textAlign(CENTER, BOTTOM);
        textSize(16 / scaleFactor);
        text(player.name, player.position.x * tileSize - position.x * tileSize, player.position.y * tileSize - position.y * tileSize - (tileSize * 0.9) / scaleFactor / 2 - 5);
        // drawing the health bar of the player below
        fill(255, 0, 0);
        rect(player.position.x * tileSize - position.x * tileSize - (tileSize * 0.9) / scaleFactor / 2, player.position.y * tileSize - position.y * tileSize + (tileSize * 0.9) / scaleFactor / 2 + 5, (tileSize * 0.9) / scaleFactor, 5);
        fill(0, 255, 0);
        rect(player.position.x * tileSize - position.x * tileSize - (tileSize * 0.9) / scaleFactor / 2, player.position.y * tileSize - position.y * tileSize + (tileSize * 0.9) / scaleFactor / 2 + 5, (tileSize * 0.9) / scaleFactor * (player.health / 100), 5);
        pop();
    });
}

function drawUI(){ // draws the score board and other elements
    push();
    // drawing the position of the player on the top left of the screen
    let fontSize = windowWidth/40;
    textSize(fontSize);
    fill(255);
    rect(0, 0, textWidth(`Position: X= ${position.x.toFixed(2)}, Y= ${position.y.toFixed(2)}, Angle= ${(Math.round(position.angle * 100)/100).toFixed(2)}`) + 10, textAscent() + textDescent() + 10);
    fill(0);
    textAlign(LEFT, TOP);
    text(`Position: X= ${position.x.toFixed(2)}, Y= ${position.y.toFixed(2)}, Angle= ${(Math.round(position.angle * 100)/100).toFixed(2)}`, 5, 5);
    // drawing the health of the player on the bottom left of the screen
    fill(255);
    rect(0, windowHeight - textAscent() - textDescent() - 10, textWidth(`Health: ${playerHealth}/100`) + 10, textAscent() + textDescent() + 10);
    fill(0);
    text(`Health: ${playerHealth}/100`, 5, windowHeight - textAscent() - textDescent());
    // drawing the stamina of the player on the bottom right of the screen
    fill(255);
    rect(windowWidth - textWidth(`Stamina: 100/100`) - 10, windowHeight - textAscent() - textDescent() - 10, textWidth(`Stamina: 100/100`) + 10, textAscent() + textDescent() + 10);
    fill(0);
    textAlign(RIGHT, TOP);
    text(`Stamina: ${playerStamina}/100`, windowWidth - 5, windowHeight - textAscent() - textDescent());
    // drawing the number of bullets the item currently selected has
    if(inventory[selectedItemSlot] && inventory[selectedItemSlot].ammo !== undefined){ // if there is an item in the selected slot and it has ammo
        console.log(inventory[selectedItemSlot]);
        fill(255);
        rect(windowWidth - textWidth('Ammo: ' + inventory[selectedItemSlot].ammo) - 10, windowHeight - textAscent() - textDescent() - 20 - (tileSize + 5), textWidth('Ammo: ' + inventory[selectedItemSlot].ammo) + 10, textAscent() + textDescent() + 10);
        fill(0);
        textAlign(RIGHT, TOP);
        text('Ammo: ' + inventory[selectedItemSlot].ammo, windowWidth - 5, windowHeight - textAscent() - textDescent() - 10 - (tileSize + 5));
    }
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
            if(images[inventory[i + 2].type]){ // if there is an image for the item type then draw it
                let img = images[inventory[i + 2].type];
                imageMode(CENTER);
                image(img, windowWidth / 2 + i * (tileSize + 5), windowHeight - tileSize / 2 - 10, tileSize * 0.6, tileSize * 0.6);
            }else {
                fill(inventory[i + 2].color.r, inventory[i + 2].color.g, inventory[i + 2].color.b);
                ellipse(windowWidth / 2 + i * (tileSize + 5), windowHeight - tileSize / 2 - 10, tileSize * 0.6, tileSize * 0.6);
            }
            fill(255);
            textAlign(CENTER, CENTER);
            textSize(fontSize * 0.8);
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
        translate(windowWidth / 2, windowHeight / 2);
        let scaleX = windowWidth / (40 * tileSize);
        let scaleY = windowHeight / (40 * tileSize);
        let scaleFactor = Math.min(scaleX, scaleY, 1);
        scale(scaleFactor);
        //console.log(item.type);
        if(images[item.type]){ // if there is an image for the item type then draw it
            let img = images[item.type];
            imageMode(CENTER);
            image(img, item.position.x * tileSize - position.x * tileSize, item.position.y * tileSize - position.y * tileSize, tileSize*1.5, tileSize*1.5);
        }else {
            fill(item.color.r, item.color.g, item.color.b);
            ellipse(item.position.x * tileSize - position.x * tileSize, item.position.y * tileSize - position.y * tileSize, tileSize*1.5, tileSize*1.5);
        }
        pop();
        if(distance(position, item.position) < minDistance){ // finding the nearest item to the player
            minDistance = distance(position, item.position);
            nearestItem = item;
        }
    });
    if(nearestItem && distance(position, nearestItem.position) < 2){ // if the player is close enough then drawing a circle with the letter E, this doesnt affect the players ability to interact with the item
        push();
        translate(windowWidth / 2, windowHeight / 2);
        let scaleX = windowWidth / (40 * tileSize);
        let scaleY = windowHeight / (40 * tileSize);
        let scaleFactor = Math.min(scaleX, scaleY, 1);
        scale(scaleFactor);
        noFill();
        stroke(255, 255, 0);
        ellipse(nearestItem.position.x * tileSize - position.x * tileSize, nearestItem.position.y * tileSize - position.y * tileSize, tileSize * 1.2, tileSize * 1.2);
        fill(255, 255, 0);
        textSize(16);
        textAlign(CENTER, CENTER);
        text("E", nearestItem.position.x * tileSize - position.x * tileSize, nearestItem.position.y * tileSize - position.y * tileSize);
        pop();
    }
}

function drawBulletsAndGrenades(){ // draws the bullets and grenades that are near enough to the player
    if(!mapData) return;
    mapData.bullets.forEach((bullet) => {
        push();
        translate(windowWidth / 2, windowHeight / 2);
        let scaleX = windowWidth / (40 * tileSize);
        let scaleY = windowHeight / (40 * tileSize);
        let scaleFactor = Math.min(scaleX, scaleY, 1);
        scale(scaleFactor);
        //console.log(bullet);
        if(bulletImages[bullet.bulletType]){ // if there is an image for the bullet type then drawing it
            let img = bulletImages[bullet.bulletType];
            imageMode(CENTER);
            translate(bullet.position.x * tileSize - position.x * tileSize, bullet.position.y * tileSize - position.y * tileSize);
            rotate(bullet.angle);
            image(img, 0, 0, tileSize * 0.5, tileSize * 0.3);
        }else{
            fill(255, 255, 0);
            ellipse(bullet.position.x * tileSize - position.x * tileSize, bullet.position.y * tileSize - position.y * tileSize, tileSize * 0.3, tileSize * 0.3);
        }
        pop();
    });
    mapData.grenades.forEach((grenade) => {
        push();
        translate(windowWidth / 2, windowHeight / 2);
        let scaleX = windowWidth / (40 * tileSize);
        let scaleY = windowHeight / (40 * tileSize);
        let scaleFactor = Math.min(scaleX, scaleY, 1);
        scale(scaleFactor);
        if(images["grenade"]){ // if there is an image for the grenade type then drawing it
            let img = images["grenade"];
            imageMode(CENTER);
            image(img, grenade.position.x * tileSize - position.x * tileSize, grenade.position.y * tileSize - position.y * tileSize, tileSize * 0.6, tileSize * 0.6);
        }else{
            fill(0, 255, 0);
            ellipse(grenade.position.x * tileSize - position.x * tileSize, grenade.position.y * tileSize - position.y * tileSize, tileSize * 0.5, tileSize * 0.5);
        }
        pop();
    });
}

function drawSelf(){ // draws the player in the center of the screen and later it will draw whatever he holds
    // drawing the player
    push();
    fill(playerColor.r, playerColor.g, playerColor.b);
    ellipse(windowWidth / 2, windowHeight / 2, tileSize * 0.9, tileSize * 0.9);
    // drawing a line to indicate the direction the player is facing
    stroke(255, 0, 0);
    line(windowWidth / 2, windowHeight / 2, windowWidth / 2 + cos(position.angle) * tileSize * 0.8, windowHeight / 2 + sin(position.angle) * tileSize * 0.8);
    pop();
}

function setup(){ // this function is automatically called once by p5.js
    tileSize = windowWidth > windowHeight ? windowHeight / 20 : windowWidth / 20; // setting the tile size based on the bigger dimension
    let canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent("gameCanvas")
    images = {
        "grenade": loadImage('/images/Explosives/explosiveGrenade.png'),
        "pistol": loadImage("/images/handguns/pistol1.png"),
        "health": loadImage("/images/otherItems/medkit.png")
        // later there will be more, also later it will be loaded dynamically, for now there are only three types of items so this is fine
    }
    bulletImages ={
        "large": loadImage("/images/Bullets/Bullet-large.png"),
        "shotgun": loadImage("/images/Bullets/Bullet-shotgun.png"),
        "small": loadImage("/images/Bullets/Bullet-small.png")
    }
}

function draw(){ // this function is automatically called by p5.js, it is used for drawing on the canvas
    background(0, 0, 255);
    drawMap();
    drawItems();
    drawBulletsAndGrenades();
    drawPlayers();
    drawSelf();
    drawUI();
}