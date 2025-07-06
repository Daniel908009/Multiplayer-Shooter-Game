function randomizeUsername(){ // called when the user randomizes the username
    let result = '';
    // asking the server for a random username
    fetch('/random-username', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(response => {
        if (response.ok) {
            response.text().then(t => {
                //console.log(t);
                result = t.slice(1, -1); // removing the quotes from the string
                //console.log(document.getElementById("username"));
                document.getElementById("username").value = result;
            });
        } else {
            response.text().then(text => {
                alert(`Error fetching random username: ${text}`);
            });
        }
    })
}

function randomizeLobbyID(){ // called when the user clicks the rand lobby ID button thats in the create lobby modal
    let result = '';
    for (let i = 0; i < 12; i++) {
        result += String.fromCharCode(Math.floor(Math.random() * 26) + 65);
    }
    document.getElementById("lobbyID").value = result;
}

function randomizePassword(){ // called when the user clicks the randomize password button thats in the create lobby modal
    let result = "";
    let randomNumber = Math.floor(Math.random() * 20) + 8;
    for (let i = 0; i < randomNumber; i++) {
        let charCode = Math.floor(Math.random() * 94) + 33;
        result += String.fromCharCode(charCode);
    }
    document.getElementById("lobbyPassword").value = result;
}

function showCreateLobbyModal(){ // showing the modal for creating a lobby
    publicLobbiesModal.hide(); // hiding the previous modal so they dont overlap
    const modal = new bootstrap.Modal(document.getElementById('createLobby'));
    modal.show();
    // clearing the inputs in case the user opens the modal multiple times
    document.getElementById("lobbyID").value = '';
    document.getElementById("lobbyPassword").value = '';
    document.getElementById("public").checked = true;
}

function requestCreateLobby(){ // function for creating a lobby on the server
    let username = document.getElementById("username").value.trim();
    let lobbyID = document.getElementById("lobbyID").value.trim();
    let password = document.getElementById("lobbyPassword").value.trim();
    let public = document.getElementById("public").checked;
    let maxPlayers = document.getElementById("maxPlayers").value
    // creating the lobby
    fetch('/create-lobby', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lobbyId: lobbyID, password: password, public: public, maxPlayers: maxPlayers, username: username })
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
    let password = document.getElementById("lobbyPassword").value.trim();
    // joining the lobby
    fetch('/join-lobby', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lobbyId: lobbyID, playerName: username, password: password })
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


const modal = new bootstrap.Modal(document.getElementById('privateLobby'))
function joinPrivateLobby(){ // showing the modal for joining a private lobby
    //console.log(modal);
    modal.show();
}

function requestPrivateLobbyJoin(){ // called when the user submits the join private lobby form
    modal.hide();
    joinLobby();
}

const publicLobbiesModal = new bootstrap.Modal(document.getElementById('publicLobbies'));
function showPublicLobbies(){ // displaying all the public lobbies from the server
    fetch('/get-public-lobbies', {
        method: 'Get',
        headers: {
            'Content-Type': 'application/json'
        }
        }).then(response => {
            //console.log(response)
            if (response.ok) {
                response.json().then(data => {
                    //console.log("Public lobbies fetched successfully");
                    //console.log(data);
                    const lobbyList = document.getElementById("lobbyList");
                    lobbyList.innerHTML = '';
                    if (data.message) {
                        lobbyList.innerHTML = `<li class="list-group-item text-center">${data.message}</li>`;
                    }else{
                        data.forEach(lobby => {
                            const listItem = document.createElement('li');
                            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
                            listItem.textContent = `Lobby ID: ${lobby.id} - Players: ${lobby.players}`;
                            const joinButton = document.createElement('button');
                            joinButton.className = 'btn btn-primary';
                            joinButton.textContent = 'Join';
                            joinButton.onclick = () => {
                                window.location.href = `/game/${lobby.id}?username=${encodeURIComponent(document.getElementById("username").value.trim())}`;
                            };
                            listItem.appendChild(joinButton);
                            lobbyList.appendChild(listItem);
                        });
                    }
                });
            }
            else {
                response.text().then(text => {
                    alert(`Error fetching public lobbies: ${text}`);
                });
            }})
    publicLobbiesModal.show();
}

function openGithubWindow(){ // function that opens the game documentation in a new tab
    window.open("https://github.com/Daniel908009/Multiplayer-Shooter-Game");
}