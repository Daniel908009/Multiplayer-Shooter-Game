function randomizeUsername(){
    console.log("Randomizing username");
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
