const webSocket = new WebSocket(`ws://${location.host}`);

webSocket.addEventListener('open', () => {
    console.log('Connected to the server');
    const rString = new URLSearchParams(window.location.search).get('randomString');
    //console.log("Joining map creator with string: " + rString);
    webSocket.send(JSON.stringify({ action: 'joinCreator', randomString: rString }));
});

function setup(){ // called once by p5.js
    let div = document.getElementById('drawingArea');
    let width = div.offsetWidth;
    let height = div.offsetHeight;
    let canvas = createCanvas(width, window.innerHeight);
    canvas.parent('drawingArea');
    console.log("Canvas created with width: " + width + " and height: " + height);
}

function draw(){ // called 60 times a second by p5.js
    background(255, 0,0);
}