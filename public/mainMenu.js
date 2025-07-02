function randomizeUsername(){
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += String.fromCharCode(Math.floor(Math.random() * 26) + 65);
    }
    document.getElementById("username").value = result;
}
function randomizeLobbyID(){
    let result = '';
    for (let i = 0; i < 12; i++) {
        result += String.fromCharCode(Math.floor(Math.random() * 26) + 65);
    }
    document.getElementById("lobbyID").value = result;
}
function createLobby(){
    let username = document.getElementById("username").value.trim();
    let lobbyID = document.getElementById("lobbyID").value.trim();
    // validating entries
    if (username.length < 3 || username.length > 6) {
        alert("Username must be between 3 and 6 characters long.");
        return;
    }
    if (lobbyID.length < 5){
        alert("Lobby ID must be at least 5 characters long.");
        return;
    }
    // creating the lobby
    fetch('/create-lobby', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lobbyId: lobbyID })
    }).then(response => {
        if (response.ok) {
            // redirect to the lobby
            window.location.href = `/game/${lobbyID}?username=${encodeURIComponent(username)}`;
        } else {
            response.text().then(text => {
                alert(`Error creating lobby: ${text}`);
            });
        }
    }
    )
}
function joinLobby() {
    let username = document.getElementById("username").value.trim();
    let lobbyID = document.getElementById("lobbyID").value.trim();
    // validating entries
    if (username.length < 3 || username.length > 6) {
        alert("Username must be between 3 and 6 characters long.");
        return;
    }
    if (lobbyID.length < 5){
        alert("Lobby ID must be at least 5 characters long.");
        return;
    }
    // joining the lobby
    fetch('/join-lobby', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lobbyId: lobbyID, playerName: username })
    }).then(response => {
        if (response.ok) {
            // redirect to the lobby
            window.location.href = `/game/${lobbyID}?username=${encodeURIComponent(username)}`;
        } else {
            response.text().then(text => {
                alert(`Error joining lobby: ${text}`);
            });
        }
    });
}