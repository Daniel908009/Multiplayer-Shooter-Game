class MapTile{
    constructor(x, y, size) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.type = {name: 'grass', color: [40, 150, 40]}; // later there will be a list of types
    }

    draw() {
        // Draw the tile
        fill(this.type.color);
        rect(this.x, this.y, this.size, this.size);
    }

    contains(points) {
        return (this.x + this.size > points.x1 && this.x < points.x2 && this.y + this.size > points.y1 && this.y < points.y2);
    }
}

// important global variables
let zoom = 1.0;
let offsetX = 0;
let offsetY = 0;
let speed = 10;
let tileSize;
let mapTiles = [];
let currentTool = "Selector";
let selectedTiles = [];
let selectionGridInformation = {x1: null, y1: null, x2: null, y2: null}; // x1, y1 = start point, x2, y2 = end point

const webSocket = new WebSocket(`ws://${location.host}`);

webSocket.addEventListener('open', () => {
    console.log('Connected to the server');
    const rString = new URLSearchParams(window.location.search).get('randomString');
    //console.log("Joining map creator with string: " + rString);
    webSocket.send(JSON.stringify({ action: 'joinCreator', randomString: rString }));
});


// every time the windows is resized the canvas needs to be resized to fit perfectly
window.addEventListener('resize', () => {
    let div = document.getElementById('drawingArea');
    let width = div.offsetWidth;
    let height = div.offsetHeight;
    resizeCanvas(width, height);
    //console.log("Canvas resized to width: " + width + " and height: " + height);
    tileSize = width / 30;
    //resizing all the tiles
    mapTiles.forEach(tile => {
        tile.x = (tile.x / tile.size) * tileSize;
        tile.y = (tile.y / tile.size) * tileSize;
        tile.size = tileSize;
    });
});

window.addEventListener('keydown', (event) => {// on pressed key the offset will be changed
    if (event.key === 'w') { // move up
        offsetY += speed;
    }
    if (event.key === 's') { // move down
        offsetY -= speed;
    }
    if (event.key === 'a') { // move left
        offsetX += speed;
    }
    if (event.key === 'd') { // move right
        offsetX -= speed;
    }
    if (event.key === 'r' || event.key === 'backspace') { // reset the offset
        offsetX = 0;
        offsetY = 0;
    }
})

window.addEventListener('wheel', (event) => {
    if (event.deltaY < 0) {
        zoom *= 1.1;
    } else {
        zoom /= 1.1;
    }
    zoom = constrain(zoom, 0.1, 3.0);
});

function centerMap(){
    //console.log(offsetX, offsetY);
    offsetX = 0;
    offsetY = 0;
}

function speedToMax() {
    speed = 100;
    document.getElementById('speedDisplay').innerText = "Speed: " + speed/10;
}

function speedToBase() {
    speed = 10;
    document.getElementById('speedDisplay').innerText = "Speed: " + speed/10;
}

let gridSizeX, gridSizeY;
function createGrid(){ // function for creating a grid that will be drawn on the canvas
    if(document.getElementById('gridRows').value === '' || document.getElementById('gridCols').value === ''){
        alert("Please enter valid grid dimensions");
        return;
    }else if (document.getElementById('gridRows').value < 1 || document.getElementById('gridCols').value < 1 || document.getElementById('gridRows').value > 100 || document.getElementById('gridCols').value > 100){
        alert("Please enter valid grid dimensions (1-100)");
        return;
    }
    gridSizeX = document.getElementById('gridRows').value;
    gridSizeY = document.getElementById('gridCols').value;
    //console.log("Creating grid with size: " + gridSizeX + "x" + gridSizeY);
    for (let i = 0; i < gridSizeX; i++) {
        for (let j = 0; j < gridSizeY; j++) {
            mapTiles.push(new MapTile(i * tileSize, j * tileSize, tileSize));
            //console.log("Creating tile at: " + (i * tileSize) + ", " + (j * tileSize));
        }
    }
}

function changeSpeed(amount) {
    speed += amount;
    if(speed > 100 ){
        alert("Speed cannot exceed 10");
    }else if (speed < 1){
        alert("Speed cannot be less than 0.1");
    }
    speed = constrain(speed, 1, 100);
    document.getElementById('speedDisplay').innerText = "Speed: " + speed/10;
}

function stopSelection(event) {
    //console.log("event button is " + event.button);
    if(event.button === 0) {
        window.removeEventListener('mousemove', selectionGrid);
        window.removeEventListener('mouseup', stopSelection);
        // flipping the selection in case the user selected from right to left
        if (selectionGridInformation.x1 > selectionGridInformation.x2) {
            let temp = selectionGridInformation.x1;
            selectionGridInformation.x1 = selectionGridInformation.x2;
            selectionGridInformation.x2 = temp;
        }
        if (selectionGridInformation.y1 > selectionGridInformation.y2) {
            let temp = selectionGridInformation.y1;
            selectionGridInformation.y1 = selectionGridInformation.y2;
            selectionGridInformation.y2 = temp;
        }
        let clearArray = true;
        mapTiles.forEach(tile => {
            if (tile.contains(selectionGridInformation)) {
                if(!selectedTiles.includes(tile)){
                    selectedTiles.push(tile); // add to selection
                    clearArray = false;
                }
            }
        });
        if (clearArray) {
            //console.log("Clearing selection");
            selectedTiles = [];
        }
        selectionGridInformation = {x1: null, y1: null, x2: null, y2: null};
    }
}

// preventing the default context menu from appearing when right clicking the canvas
const canvas = document.getElementById("drawingArea");
canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
});

// right click to deselect all tiles, left click is for selection, panning etc.
window.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
        leftMousePressed(event);
    }else if (event.button === 2) {
        selectedTiles = [];
    }
});

function selectionGrid() {
    selectionGridInformation.x2 = (mouseX - width/2 - offsetX)/zoom + (tileSize*gridSizeX)/2;
    selectionGridInformation.y2 = (mouseY - height/2 - offsetY)/zoom + (tileSize*gridSizeY)/2;
    //console.log(selectionGridInformation);
}

function leftMousePressed(event) {
    //console.log("mouse pressed");
    //let positionX = (mouseX - width/2 - offsetX)/zoom + (tileSize*gridSizeX)/2;
    //let positionY = (mouseY - height/2 - offsetY)/zoom + (tileSize*gridSizeY)/2;
    //console.log("Mouse pressed at: " + positionX + ", " + positionY);
    //mapTiles.forEach(tile => {
    //    console.log("Tile at: " + tile.x + ", " + tile.y);
    //});
    if(currentTool === "Selector"){
        let mx = event.clientX;
        let my = event.clientY;
        selectionGridInformation.x1 = (mx - width/2 - offsetX)/zoom + (tileSize*gridSizeX)/2;
        selectionGridInformation.y1 = (my - height/2 - offsetY)/zoom + (tileSize*gridSizeY)/2;
        selectionGridInformation.x2 = (mx - width/2 - offsetX)/zoom + (tileSize*gridSizeX)/2;
        selectionGridInformation.y2 = (my - height/2 - offsetY)/zoom + (tileSize*gridSizeY)/2;
        //console.log("Initial selection grid: ", selectionGridInformation);
        selectionGrid(); // call it once to set the initial position
        window.addEventListener('mousemove', selectionGrid);
        window.addEventListener('mouseup', stopSelection);
        /*mapTiles.forEach(tile => {
            if (tile.contains(positionX, positionY)) {
                console.log("Clicked tile of X: " + tile.x/tileSize + ", Y: " + tile.y/tileSize);
                if(selectedTiles.includes(tile)){
                    selectedTiles = selectedTiles.filter(t => t !== tile); // remove from selection
                }else{
                    selectedTiles.push(tile); // add to selection
                }
            }
        });*/
    }else if(currentTool === "Panning"){
        let startX = mouseX;
        let startY = mouseY;
        function pan(event) {
            offsetX += event.clientX - startX;
            offsetY += event.clientY - startY;
            startX = event.clientX;
            startY = event.clientY;
        }
        function stopPan() {
            window.removeEventListener('mousemove', pan);
            window.removeEventListener('mouseup', stopPan);
        }
        window.addEventListener('mousemove', pan);
        window.addEventListener('mouseup', stopPan);
    }
}

function selectTool(tool) {
    currentTool = tool;
    if(currentTool === "" || currentTool === null){
        currentTool = "selector";
    }
}

function drawGrid(){ // function for drawing the grid on the canvas
    stroke(200);
    //console.log(tileSize)
    for (let i = 0; i-1 < gridSizeX; i++) { // vertical lines
        line(i * tileSize - gridSizeX * tileSize / 2, -gridSizeY * tileSize / 2, i * tileSize - gridSizeX * tileSize / 2, gridSizeY * tileSize / 2);
    }
    for (let i = 0; i-1 < gridSizeY; i++) { // horizontal lines
        line(-gridSizeX * tileSize / 2, i * tileSize - gridSizeY * tileSize / 2, gridSizeX * tileSize / 2, i * tileSize - gridSizeY * tileSize / 2);
    }
}

function drawTiles(){ // function for drawing the tiles on the canvas
    push();
    translate(-gridSizeX * tileSize / 2, -gridSizeY * tileSize / 2); // this has to be done here as well since the original translate is also in push-pop
    mapTiles.forEach(tile => {
        //console.log("drawing tile")
        tile.draw();
    });
    pop();

    // center point
    fill(255, 0, 0, 255);
    ellipse(0, 0, tileSize/2, tileSize/2);
}

function drawInformation() { // function for drawing the information, for now only zoom level
    fill(255);
    textSize(16);
    // displaying position information
    textAlign(LEFT, TOP);
    text("Zoom Level: " + nf(zoom, 1, 2) + " | Offset X: " + offsetX/10 + " | Offset Y: " + offsetY/10, 10, 10);
    // displaying current tool
    textAlign(LEFT, TOP);
    text("Current Tool: " + currentTool, 5, window.innerHeight - 20);
}

function drawSelection(){ // function for drawing the selected tiles on the canvas
    // highlighting the selected tiles
    push();
    stroke(255, 0, 0);
    strokeWeight(1);
    translate(-gridSizeX * tileSize / 2, -gridSizeY * tileSize / 2);
    selectedTiles.forEach(tile => {
        noFill();
        // highlighting is done with a circle since a square doesnt work because if all other tiles are selected then the one in the middle looks also selected. if that makes sense
        ellipse(tile.x + tileSize / 2, tile.y + tileSize / 2, tileSize/2, tileSize/2);
    });
    pop();
}

function drawSelectionGrid(){ // function for drawing the selection grid on the canvas
    if(selectionGridInformation.x1 === null && selectionGridInformation.y1 === null && selectionGridInformation.x2 === null && selectionGridInformation.y2 === null) return;
    push();
    stroke(255, 0, 0);
    strokeWeight(2);
    translate(-gridSizeX * tileSize / 2, -gridSizeY * tileSize / 2);
    noFill();
    rect(selectionGridInformation.x1, selectionGridInformation.y1, selectionGridInformation.x2 - selectionGridInformation.x1, selectionGridInformation.y2 - selectionGridInformation.y1);
    pop();
}

function drawZones(){} // function for drawing the zones on the canvas

function setup(){ // called once by p5.js
    let div = document.getElementById('drawingArea');
    let width = div.offsetWidth;
    let canvas = createCanvas(width, window.innerHeight);
    canvas.parent('drawingArea');
    //console.log("Canvas created with width: " + width + " and height: " + height);
    tileSize = document.getElementById('drawingArea').offsetWidth / 30;
    createGrid();
}


function draw(){ // called 60 times a second by p5.js
    push();
    background(0, 0,255);
    translate(width / 2 + offsetX, height / 2 + offsetY); // centering the canvas
    scale(zoom); // applying the zoom to the canvas
    drawGrid();
    drawTiles();
    drawSelection();
    drawSelectionGrid();
    drawZones();
    pop();
    
    drawInformation();
}