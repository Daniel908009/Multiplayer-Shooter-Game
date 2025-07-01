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
    if (data.action === 'joined') {
        console.log(`Joined lobby as ${data.isMain ? 'main' : 'secondary'} player with ID: ${data.uniqueID}`);
    } else if (data.action === 'newMain') {
        console.log('You are now the main player');
    }
});