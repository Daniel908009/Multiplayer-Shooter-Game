// updating the username in both the main menu and the create lobby modal
const mainMenuUsername = document.getElementById('username');
const lobbyUsername = document.getElementById('usernameForLobbyCreation');
mainMenuUsername.addEventListener('input', () => {
    lobbyUsername.value = mainMenuUsername.value;
});
lobbyUsername.addEventListener('input', () => {
    mainMenuUsername.value = lobbyUsername.value;
})

if(new URLSearchParams(window.location.search).has('error')){ // displaying an error if there is one in the URL, this can happen if a player was send here from another page that experienced a problem
    const errorMessage = new URLSearchParams(window.location.search).get('error');
    alert(errorMessage);
    window.history.replaceState({}, document.title, window.location.pathname);
}

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
                result = t.slice(1, -1); // removing the quotes from the string
                document.getElementById("username").value = result;
                document.getElementById("usernameForLobbyCreation").value = result;
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
            response.json().then(data => {
                window.location.href = `/game/${lobbyID}?username=${encodeURIComponent(username)}&securityString=${data.string}`;
            });
        } else {
            response.text().then(text => {
                alert(`Error creating lobby: ${text}`);
            });
        }
    }).catch(error => {
        console.error('Error creating lobby:', error);
    });
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
        body: JSON.stringify({ lobbyId: lobbyID, password: password, playerName: username })
    }).then(response => {
        if (response.ok) {
            response.json().then(data => {
                window.location.href = `/game/${lobbyID}?username=${encodeURIComponent(username)}&securityString=${data.securityString}`;
            });
        } else {
            response.text().then(text => {
                alert(`Error joining lobby: ${text}`);
            });
        }
    }).catch(error => {
        console.error('Error joining lobby:', error);
    });
}


const modal = new bootstrap.Modal(document.getElementById('privateLobby'))
function joinPrivateLobby(){ // showing the modal for joining a private lobby
    modal.show();
}

function requestPrivateLobbyJoin(){ // called when the user submits the join private lobby form
    modal.hide();
    joinLobby();
}

function requestPublicLobbies(){ // requesting the lobbies from the server
    console.log("Requesting public lobbies");
    fetch('/get-public-lobbies', {
        method: 'Get',
        headers: {
            'Content-Type': 'application/json'
        }
        }).then(response => {
            if (response.ok) {
                response.json().then(data => {
                    const lobbyList = document.getElementById("lobbyList");
                    lobbyList.innerHTML = '';
                    if (data.message) {
                        lobbyList.innerHTML = `<li class="list-group-item text-center">${data.message}</li>`;
                    }else{
                        data.forEach(lobby => {
                            const div = document.createElement('div');
                            div.classList.add('locked-row-container', 'gap');
                            const p = document.createElement('p');
                            p.classList.add('pt-3');
                            p.innerHTML = `<strong>Lobby ID:</strong> ${lobby.id} - <strong>Players:</strong> ${lobby.players}/${lobby.maxPlayers}`;
                            const button = document.createElement('button');
                            button.className = 'btn btn-primary';
                            button.textContent = 'Join';
                            button.onclick = () => {
                                document.getElementById("lobbyID").value = lobby.id;
                                document.getElementById("lobbyPassword").value = ''; // clearing the password field
                                joinLobby();
                            };
                            div.appendChild(p);
                            div.appendChild(button);
                            lobbyList.appendChild(div);
                        });
                    }
                });
            }
            else {
                response.text().then(text => {
                    alert(`Error fetching public lobbies: ${text}`);
                });
            }}).catch(error => {
                console.error('Error fetching public lobbies:', error);
                const lobbyList = document.getElementById("lobbyList");
                lobbyList.innerHTML = '<li class="list-group-item text-center">Failed to fetch public lobbies. Please try again later.</li>';
                alert('Failed to fetch public lobbies. Please try again later.');
            });
}

const publicLobbiesModal = new bootstrap.Modal(document.getElementById('publicLobbies'));
function showPublicLobbies(){ // displaying all the public lobbies from the server
    requestPublicLobbies()
    publicLobbiesModal.show();
}

function customMapWindow(){ // function that opens the custom map designer
    // requesting the server to create a custom map creator
    fetch("/custom-map-creator", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
    }).then(response => {
        if (response.ok) {
            response.json().then(data => {
                window.location.href =`/mapCreator/${data.randomString}?randomString=${data.randomString}`;
            });
        } else {
            response.text().then(text => {
                alert(`Error creating custom map creator: ${text}`);
            });
        }
    })
}

function openGithubWindow(){ // function that opens the game documentation in a new tab
    window.open("https://github.com/Daniel908009/Multiplayer-Shooter-Game");
}