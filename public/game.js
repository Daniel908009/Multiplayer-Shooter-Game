// MODAL CODE
const modalElement = document.getElementById('lobbyModal');
const lobbyModal = new bootstrap.Modal(modalElement);
// Showing the modal when the page loads
document.addEventListener('DOMContentLoaded', () => {
  lobbyModal.show();
});

const socket = new WebSocket(`ws://${location.host}`);

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
            //console.log("thisPlayer: ", thisPlayer)
            //console.log("player: ", player)
            if(player.id === thisPlayer.id && !thisPlayer.isMain){
                //console.log("first option")
                switchButton.innerHTML = `
                    <input class="form-check-input" type="checkbox" id="readySwitch-${player.id}" onchange="requestChangeReadyState(${player.id})" ${thisPlayer.ready ? 'checked' : ''}>`;
            }else{
                //console.log("second option"+ player.ready)
                switchButton.innerHTML = `
                    <input class="form-check-input" type="checkbox" id="readySwitch-${player.id}" disabled ${player.ready ? 'checked' : ''}> `;
            }
            switchButton.innerHTML += `<label class="form-check-label" for="readySwitch-${player.id}">Ready</label>`;
            //console.log("seted up player switch for " + player.id);
            //console.log(switchButton)
            div.appendChild(switchButton);
            playersList.appendChild(div);
        });
    }
});

function requestGameStart(){ // function to request the game start
    const lobbyId = window.location.pathname.split('/').pop();
    socket.send(JSON.stringify({ action: 'startGame', lobbyId }));
}

function requestChangeReadyState(playerId){ // function to change the ready state of the player
    const isReady = document.getElementById(`readySwitch-${playerId}`).checked;
    console.log(isReady)
    socket.send(JSON.stringify({ action: 'readyUPchange', isReady: isReady }));
}

function setup(){ // this function is automatically called once by p5.js
    let canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent("gameCanvas")
}

function draw(){ // this function is automatically called by p5.js, it is used for drawing on the canvas
    background(255, 0, 0);
}