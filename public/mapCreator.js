class MapTile{ // class for all the map tiles
    constructor(x, y, size) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.type = {name: 'grass', color: [40, 150, 40]}; // later there will be a list of types
        this.zones = [];
    }

    draw() { // function to draw the tile
        fill(this.type.color);
        rect(this.x, this.y, this.size, this.size);
    }

    contains(points) { // function for figuring out if the tile is in a specific box
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
let selectedTiles = []; // contains the tiles that have been selected in the canvas
let selectionGridInformation = {x1: null, y1: null, x2: null, y2: null}; // x1, y1 = start point, x2, y2 = end point
let selectedType = {name: "Nothing"}; // currently selected tile/zone type
let tileTypes = { // all the different tile types
    "Grass": {name: "Grass", color: [40, 150, 40]},
    "Sand": {name: "Sand", color: [194, 178, 128]},
    "Water": {name: "Water", color: [0, 0, 255]},
    "Wooden Wall": {name: "Wooden Wall", color: [139, 69, 19]},
    "Wooden Floor": {name: "Wooden Floor", color: [160, 82, 45]},
    "Gravel": {name: "Gravel", color: [128, 128, 128]}
};
let zoneTypes = { // all the different zone types
    "Weapons": {name: "Weapons", color: [255, 0, 0]},
    "Health": {name: "Health", color: [0, 255, 0]}
}
let zoneSelected = false; // keeps track of whether a zone is currently selected
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0; // figuring out if the device is touch-enabled(probably mobile)
let add = true;

const webSocket = new WebSocket(`ws://${location.host}`);

webSocket.addEventListener('open', () => {
    const rString = new URLSearchParams(window.location.search).get('randomString');
    webSocket.send(JSON.stringify({ action: 'joinCreator', randomString: rString })); // asking the server to block the entry to this creator since its full
});
webSocket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.action === 'destroyPage') {
        window.location.href = '/?error=Map creator could not be opened because of a faulty join request. Please try again.';
    }
});

// every time the windows is resized the canvas needs to be resized as well
window.addEventListener('resize', () => {
    resizeEditor();
});

function resizeEditor() {
    let div = document.getElementById('drawingArea');
    let width = div.offsetWidth;
    let height = div.offsetHeight;
    resizeCanvas(width, height);
    tileSize = width / 30;
    // resizing all the tiles because they use the tile size variable
    mapTiles.forEach(tile => {
        tile.x = (tile.x / tile.size) * tileSize;
        tile.y = (tile.y / tile.size) * tileSize;
        tile.size = tileSize;
    });
}

let oldScrollY; // has to be outside the listener otherwise this wont work
window.addEventListener('scroll', () => { // listening for scrolling, this is done because on smaller screens there needs to be an automatic scroll in the website, this comment doesnt make any sense does it?
    let scrollY = window.scrollY;
    if (isTouch) {
        if(scrollY > document.getElementById("menu").offsetTop-document.getElementById("menu").offsetTop/3 && scrollY < document.getElementById("menu").offsetTop-document.getElementById("menu").offsetTop/5 && oldScrollY > scrollY) {
            scrollTo(0, 0);
        }
        oldScrollY = scrollY;
    }
});

let keysPressed = {}; // list of currently pressed keys
window.addEventListener('keydown', (event) => {// on pressed key the offset will be changed
    let target = event.target.tagName.toLowerCase();
    if (target === 'input' || target === 'textarea' || target.isContentEditable) {
        return;
    }
    keysPressed[event.key] = true;
});

window.addEventListener('keyup', (event) => {
    keysPressed[event.key] = false;
});

function update() {
    if (keysPressed['w'] || keysPressed['bW']) {
        offsetY += speed;
    }
    if (keysPressed['s'] || keysPressed['bS']) {
        offsetY -= speed;
    }
    if (keysPressed['a'] || keysPressed['bA']) {
        offsetX += speed;
    }
    if (keysPressed['d'] || keysPressed['bD']) {
        offsetX -= speed;
    }
    if (keysPressed['q'] || keysPressed['bQ']) {
        zoom *= 1.1;
    }
    if (keysPressed['e'] || keysPressed['bE']) {
        zoom /= 1.1;
    }
    if (keysPressed['r']) {
        centerMap();
    }
}

function handleUP(event){
    if (event.target.closest('#drawingArea')) {
        keysPressed['bW'] = false;
        keysPressed['bA'] = false;
        keysPressed['bS'] = false;
        keysPressed['bD'] = false;
        keysPressed['bQ'] = false;
        keysPressed['bE'] = false;
    }
}

window.addEventListener("mouseup",handleUP); // setting the movement from the buttons to zero when the mouse is lifted
window.addEventListener("touchend",handleUP); // the same as mouseup but for mobiles

window.addEventListener('wheel', (event) => { // listener for zooming
    if(event.target.closest('#drawingArea') && window.innerWidth > 768) { // the zooming only works if the mouse is over the canvas, this prevents zooming while scrolling the side menu, and also on smaller screens zooming is only done through dedicated buttons
        if (event.deltaY < 0) {
            zoom *= 1.1;
        } else {
            zoom /= 1.1;
        }
        zoom = constrain(zoom, 0.1, 3.0);
    }
});

function centerMap(){ // function for centering the map
    offsetX = 0;
    offsetY = 0;
}

function ResetCanvas(){ // function for reseting the canvas to the base state
    mapTiles = [];
    selectedTiles = [];
    selectionGridInformation = {x1: null, y1: null, x2: null, y2: null};
    selectedType = {name: "Nothing"};
    zoom = 1.0;
    offsetX = 0;
    offsetY = 0;
    speed = 10;
    document.getElementById('speedDisplay').innerText = "Speed: " + speed/10;
    gridSizeX = 0;
    gridSizeY = 0;
}

function speedToMax() { // function for setting speed to max
    speed = 30;
    document.getElementById('speedDisplay').innerText = "Speed: " + speed/10;
}

function selectF(type) { // function for selecting a tile or zone type
    if(type === '' || !tileTypes[type] && !zoneTypes[type]) {
        alert("Invalid tile or zone type! Type reseted to nothing.");
        selectedType = {name: "Nothing"};
        return;
    }
    selectedType = tileTypes[type] || zoneTypes[type];
    zoneSelected = !!zoneTypes[type];
    // if there are any selected tiles then changing them to the newly selected type of tile/zone
    if (selectedTiles.length > 0) {
        selectedTiles.forEach(tile => {
            if(zoneSelected){
                let addZone = true;
                tile.zones.forEach(zone => {
                    if(zone.name === selectedType.name){
                        addZone = false;
                    }
                });
                if(addZone){
                    tile.zones.push(selectedType);
                }
            }else{
                tile.type = selectedType;
            }
        });
        selectedTiles = [];
    }
}

function speedToBase() { // function for resetting the speed to base
    speed = 10;
    document.getElementById('speedDisplay').innerText = "Speed: " + speed/10;
}

function processImportedData(jsonData, checkbox, closeModal, inputElement, nameBox) { // function for processing/checking imported JSON data
    // checking that the map has everything
    if (!jsonData || !jsonData.tiles || !Array.isArray(jsonData.tiles)) { // those are the most important checks, there is of course more to check but this is good enough for now
        alert("Invalid map data!");
        return;
    }
    // If everything is valid, then proceeding with importing
    if (checkbox.checked) {
        let maps = localStorage.getItem('maps');
        if (maps) {
            maps = JSON.parse(maps);
        } else {
            maps = [];
        }
        let allowedName = true; // this has to be done through a variable like this because of the way the alert works
        maps.forEach(map => {
            if (map.name === jsonData.name) {
                alert("Map with this name already exists!");
                allowedName = false;
            }
        });
        if (!allowedName) return;
        maps.push(jsonData);
        localStorage.setItem('maps', JSON.stringify(maps));
    }
    // loading the map
    loadMap(jsonData);
    closeModal();
    inputElement.value = '';
    nameBox.value = '';
    checkbox.checked = false;
}

function importJson(typeOfImport){ // function for importing JSON data from the import maps modal
    let jsonData;
    if(typeOfImport === 'file'){
        const fileInput = document.getElementById('importJsonFileInput');
        const checkbox = document.getElementById('fileCheckbox');
        if(fileInput.files.length === 0){
            alert("Please select a JSON file to import");
            return;
        }
        let nameBox = document.getElementById('fileImportName');
        let name = nameBox.value;
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            jsonData = JSON.parse(event.target.result);
            jsonData.name = name || jsonData.name;
            processImportedData(jsonData, checkbox, closeImportMapsModal, fileInput, nameBox);
        }
        reader.readAsText(file);
    }else if(typeOfImport === 'text'){
        const textArea = document.getElementById('importJsonTextArea');
        const checkbox = document.getElementById('textCheckbox');
        let nameBox = document.getElementById('copyPasteImportName');
        let name = nameBox.value;
        jsonData = JSON.parse(textArea.value);
        jsonData.name = name || jsonData.name;
        processImportedData(jsonData, checkbox, closeImportMapsModal, textArea, nameBox);
    }
}

let gridSizeX, gridSizeY; // variables that keep track of the size of the map grid
function createGrid(){ // function for creating a grid that will be drawn on the canvas
    if(document.getElementById('gridRows').value === '' || document.getElementById('gridCols').value === ''){
        alert("Please enter valid grid dimensions");
        return;
    }else if (document.getElementById('gridRows').value < 1 || document.getElementById('gridCols').value < 1 || document.getElementById('gridRows').value > 100 || document.getElementById('gridCols').value > 100 ||  document.getElementById('gridRows').value % 2 !== 0 || document.getElementById('gridCols').value % 2 !== 0){
        alert("Please enter valid grid dimensions (1-100, only even numbers are allowed)");
        return;
    }
    let oldX = gridSizeX;
    let oldY = gridSizeY;
    gridSizeX = document.getElementById('gridRows').value;
    gridSizeY = document.getElementById('gridCols').value;
    if(mapTiles){ // in case the map tiles already exist and the grid is being resized then I need to move the existing tiles so that they stay in the middle of the grid
        let offsetX = tileSize * (gridSizeX - oldX) / 2;
        let offsetY = tileSize * (gridSizeY - oldY) / 2;
        mapTiles.forEach(tile => {
            tile.x += offsetX;
            tile.y += offsetY;
        });
    }
    for (let i = 0; i < gridSizeX; i++) {
        for (let j = 0; j < gridSizeY; j++) {
            if(mapTiles.find(t => Math.round(t.x / tileSize) === i && Math.round(t.y / tileSize) === j) === undefined){ // making sure that new tiles are only created if there isnt one already
                mapTiles.push(new MapTile(i * tileSize, j * tileSize, tileSize));
            }
        }
    }
    for (let i = mapTiles.length - 1; i >= 0; i--) { // removing tiles that are outside the new grid
        let tile = mapTiles[i];
        if(tile.x < 0 || tile.y < 0 || Math.round(tile.x / tileSize) >= gridSizeX || Math.round(tile.y / tileSize) >= gridSizeY){ // all of the tile.x and tile.y have to use Math.round otherwise they would never match because of floating point precision
            mapTiles.splice(i, 1);
        }
    }
}

function exportMap(){ // function for exporting the map
    let name = document.getElementById('exportName').value;
    if(name === ''){
        alert("Please enter a valid file name");
        return;
    }
    if(name.length > 17){
        alert("File name cannot exceed 17 characters");
        return;
    }
    if(mapTiles.length === 0){
        alert("No map tiles to export");
        return;
    }
    let exportData = {
        "name": name,
        "gridSizeX": gridSizeX,
        "gridSizeY": gridSizeY,
        "tiles": mapTiles.map(tile => {
            return {
                "x": tile.x / tileSize,
                "y": tile.y / tileSize,
                "type": tile.type,
                "zones": tile.zones
            };
        })
    }
    if(document.getElementById('exportType').value === 'copy'){
        navigator.clipboard.writeText(JSON.stringify(exportData)).then(() => {
            alert("Map data copied to clipboard");
        }).catch(err => {
            alert("Failed to copy map data to clipboard: " + err);
        });
    }else if(document.getElementById('exportType').value === 'browser'){
        let maps = localStorage.getItem('maps');
        if(maps){
            maps = JSON.parse(maps);
            while(maps.find(m => m.name === name)){
                if(name.includes("(")){
                    name = name.replace(/\(\d+\)$/, match => {
                        let num = parseInt(match.slice(1, -1));
                        return `(${num + 1})`;
                    });
                }else{
                    name += " (2)";
                }
            }
            maps.push(exportData);
            localStorage.setItem('maps', JSON.stringify(maps));
        }else{
            localStorage.setItem('maps', JSON.stringify([exportData]));
        }
        alert("Map data saved to browser storage");
    }else if(document.getElementById('exportType').value === 'json'){ // function for exporting the map as a JSON file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

function changeSpeed(amount) { // function for changing the movement speed of panning
    speed += amount;
    if(speed > 30 ){
        alert("Speed cannot exceed 30");
    }else if (speed < 1){
        alert("Speed cannot be less than 0.1");
    }
    speed = constrain(speed, 1, 30);
    document.getElementById('speedDisplay').innerText = "Speed: " + speed/10;
}

function toggleMenuElement(elementId) { // function for toggling the visibility of a side menu element
    let element = document.getElementById(elementId);
    if (element) {
        if(element.classList.contains("collapse")){
            element.classList.remove("collapse");
        }else{
            element.classList.add("collapse");
        }
    }
}

function stopSelection(event) { // function that is called when the user has finished selecting tiles
    if(event.button === 0 || event.touches){ // making sure that the left mouse button or touch was released
        let shiftKeyActive;
        if(!event.touches){
            window.removeEventListener('mousemove', selectionGrid);
            window.removeEventListener('mouseup', stopSelection);
            shiftKeyActive = event.shiftKey;
        }else{
            window.removeEventListener('touchmove', selectionGrid);
            window.removeEventListener('touchend', stopSelection);
            shiftKeyActive = !add;
        }
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
        mapTiles.forEach(tile => {
            if (tile.contains(selectionGridInformation)) {
                if(shiftKeyActive && selectedTiles.includes(tile) && !zoneSelected){
                    selectedTiles.splice(selectedTiles.indexOf(tile), 1);
                }else if(!selectedTiles.includes(tile) && !shiftKeyActive){
                    selectedTiles.push(tile);
                }else if(shiftKeyActive && zoneSelected){ // this is for removing zone types from tiles using shift left click
                    tile.zones = tile.zones.filter(zone => zone.name !== selectedType.name);
                }
            }
        });
        selectionGridInformation = {x1: null, y1: null, x2: null, y2: null};
        if(selectedType.name !== "Nothing"){ // if the selected type is not nothing then changing all the selected tiles imediately to the selected type
            selectedTiles.forEach(tile => {
                if(zoneSelected){
                    let addZone = true;
                    tile.zones.forEach(zone => {
                        if(zone.type === selectedType){
                            addZone = false;
                        }
                    });
                    if(addZone){
                        tile.zones.push(selectedType);
                    }
                }else{
                    tile.type = selectedType;
                }
            });
            selectedTiles = [];
        }
    }
}

// preventing the default context menu from appearing when right clicking the canvas
const canvas = document.getElementById("drawingArea");
canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
});

// right click to deselect all tiles, left click is for selection, panning etc.
window.addEventListener('mousedown', (event) => {
    if (event.button === 0 && event.target.closest('#drawingArea')) {
        pressedOnCanvas(event);
    }else if (event.button === 2) {
        if(event.shiftKey) {
            selectedType = { name: "Nothing" };
        }else{
            selectedTiles = [];
        }
    }
});
window.addEventListener('touchstart', (event) => { // the same as mousedown but for mobiles
    if (event.target.closest('#drawingArea')) {
        event.preventDefault();
        pressedOnCanvas(event);
    }
}, { passive: false });

function selectionGrid(event) { // function for updating the selection grid information based on the mouse position
    let mx,my;
    if(event.type.startsWith("touch")){
        mx = event.touches[0].pageX;
        my = event.touches[0].pageY;
    }else{
        mx = event.pageX;
        my = event.pageY;
    }

    selectionGridInformation.x2 = (mx - width/2 - offsetX)/zoom + (tileSize*gridSizeX)/2;
    selectionGridInformation.y2 = (my - height/2 - offsetY)/zoom + (tileSize*gridSizeY)/2;
}

function scrollToMenu() {
    // scroll to menu
    window.scrollTo({
        top: document.getElementById("menu").offsetTop,
        behavior: "smooth"
    });
}

function loadMap(map){ // function for loading a saved map into the editor
    // clearing the current map
    ResetCanvas();

    // setting the new map properties
    gridSizeX = map.gridSizeX;
    gridSizeY = map.gridSizeY;
    document.getElementById('gridRows').value = gridSizeX;
    document.getElementById('gridCols').value = gridSizeY;

    // loading the tiles
    for (let i = 0; i < gridSizeX; i++) {
        for (let j = 0; j < gridSizeY; j++) {
            mapTiles.push(new MapTile(i * tileSize, j * tileSize, tileSize));
            mapTiles[mapTiles.length - 1].type = map.tiles.find(t => t.x === i && t.y === j)?.type;
            mapTiles[mapTiles.length - 1].zones = map.tiles.find(t => t.x === i && t.y === j)?.zones || [];
        }
    }
    browserMapsModal.hide(); // hiding the selection modal
}

function deleteMap(map) { // function for deleting a saved map from the browser storage
    let maps = localStorage.getItem("maps");
    if (maps) {
        maps = JSON.parse(maps);
        maps = maps.filter(m => m.name !== map.name);
        localStorage.setItem("maps", JSON.stringify(maps));
        loadMapsIntoModal();
    }
}

function loadMainMaps(){
    document.getElementById("mainMapsModalList").innerHTML = "Loading...";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetch("/mainMaps", { signal: controller.signal })
        .then(response => {
            document.getElementById("mainMapsModalList").innerHTML = "";
            clearTimeout(timeout);
            if (!response.ok) {
                throw new Error("Server response was not ok");
            }
            return response.json();
        })
        .then(maps => {
            if(maps && maps.length > 0){
                maps.forEach(map => {
                    const div = document.createElement("div");
                    div.className = "row pt-1";
                    const mapName = document.createElement("span");
                    mapName.textContent = map.name;
                    mapName.className = "col";
                    div.appendChild(mapName);
                    const mapHeightWidth = document.createElement("span");
                    mapHeightWidth.textContent = `${map.gridSizeX}x${map.gridSizeY}`;
                    mapHeightWidth.className = "col";
                    div.appendChild(mapHeightWidth);
                    const button = document.createElement("button");
                    button.textContent = "Load Map";
                    button.onclick = () => {
                        if(document.getElementById('mainMapsLocalStorage').checked){
                            let name = map.name;
                            if(document.getElementById('mainMapsName').value !== '' && document.getElementById('mainMapsName').value.length <= 17){
                                name = document.getElementById('mainMapsName').value;
                            }else if(document.getElementById('mainMapsName').value.length > 17){
                                alert("Map name must be 17 characters or less.");
                                return;
                            }
                            let maps = localStorage.getItem('maps');
                            if(maps){
                                maps = JSON.parse(maps);
                                while(maps.find(m => m.name === name)){
                                    if(name.includes("(")){
                                        name = name.replace(/\(\d+\)$/, match => {
                                            let num = parseInt(match.slice(1, -1));
                                            return `(${num + 1})`;
                                        });
                                    }else{
                                        name += " (2)";
                                    }
                                }
                                maps.push({...map, name: name});
                                localStorage.setItem('maps', JSON.stringify(maps));
                            }else{
                                localStorage.setItem('maps', JSON.stringify([map]));
                            }
                        }
                        closeMainMapsLibraryModal();
                        loadMap(map)
                    };
                    button.className = "col btn btn-primary";
                    div.appendChild(button);
                    document.getElementById("mainMapsModalList").appendChild(div);
                });
            }else{
                const div = document.createElement("div");
                div.className = "list-group-item";
                div.textContent = "No main maps found on the server.";
                document.getElementById("mainMapsModalList").appendChild(div);
            }
        }).catch(error => {
            const msg = document.createElement("div");
            msg.className = "list-group-item";
            msg.textContent = `Error loading main maps (${error.message}).`;
            document.getElementById("mainMapsModalList").appendChild(msg);
        });
}

const exitModal = new bootstrap.Modal(document.getElementById('exitModal'));
function exitToMainPageModal() { // function to exit to the main page, activated via the side menu button
    exitModal.show();
}

const mainMapsLibraryModal = new bootstrap.Modal(document.getElementById('mainMapsLibraryModal'));
function mainMapsLibraryModalShow() {
    closeImportMapsModal();
    loadMainMaps();
    mainMapsLibraryModal.show();
}

function closeMainMapsLibraryModal() {
    mainMapsLibraryModal.hide();
}

const importMapsM = new bootstrap.Modal(document.getElementById('importMapsModal'));
function importMapsModal() {
    importMapsM.show();
}

function closeImportMapsModal() {
    importMapsM.hide();
}

const browserMapsModal = new bootstrap.Modal(document.getElementById('mapsModal'));
function showBrowserMapsModal(){
    loadMapsIntoModal();
    browserMapsModal.show();
}

function closeExitModal() {
    exitModal.hide();
}

function closeBrowserMapsModal() {
    browserMapsModal.hide();
}

function loadMapsIntoModal(){
    let maps = localStorage.getItem("maps");
    document.getElementById("savedMapsList").innerHTML = ""; // clearing the list first
    if(maps) {
        maps = JSON.parse(maps);
        maps.forEach(map => {
            const div = document.createElement("div");
            div.className = "row pt-1";
            const mapName = document.createElement("span");
            mapName.textContent = map.name;
            mapName.className = "col";
            div.appendChild(mapName);
            const mapHeightWidth = document.createElement("span");
            mapHeightWidth.textContent = `${map.gridSizeX}x${map.gridSizeY}`;
            mapHeightWidth.className = "col";
            div.appendChild(mapHeightWidth);
            deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete Map";
            deleteButton.onclick = () => deleteMap(map);
            deleteButton.className = "col btn btn-danger me-2";
            div.appendChild(deleteButton);
            const button = document.createElement("button");
            button.textContent = "Load Map";
            button.onclick = () => loadMap(map);
            button.className = "col btn btn-primary";
            div.appendChild(button);
            document.getElementById("savedMapsList").appendChild(div);
        });
    }else{
        const div = document.createElement("div");
        div.className = "list-group-item";
        div.textContent = "No saved maps in browser.";
        document.getElementById("savedMapsList").appendChild(div);
    }
}

function changePage() {
    window.location.href = "/";
}

function getRightOffset() { // function to get the right offset that is cause by the side menu, it is needed for the touchable screen buttons
    if (window.innerWidth > 767) {
        return document.getElementById('menu').offsetWidth;
    }
    return 0;
}

function pressedOnCanvas(event) {
    let buttonPressed = false; // this ensures that the selector cannot be activated while pressing one of the control buttons that appear on smaller screens
    if(isTouch){ // handling the buttons that are on screens that have touch
        let positionX;
        let positionY;
        if(event.touches){
            if(event.touches[1]){
                positionX = event.touches[1].pageX;
                positionY = event.touches[1].pageY;
            }else{
                positionX = event.touches[0].pageX;
                positionY = event.touches[0].pageY;
            }
        }else{
            positionX = event.pageX;
            positionY = event.pageY;
        }
        // handling zooming buttons
        if(positionX > 5 && positionX < tileSize*12/2 && positionY > window.innerHeight - tileSize*5 && positionY < window.innerHeight - tileSize*5 + tileSize*3){
            keysPressed['bQ'] = true;
            buttonPressed = true;
        }else if(positionX > 5 && positionX > tileSize*12/2 && positionX < 5+tileSize*12 && positionY > window.innerHeight - tileSize*5 && positionY < window.innerHeight - tileSize*5 + tileSize*3){
            keysPressed['bE'] = true;
            buttonPressed = true;
        }else if(positionX > 5 && positionX < 5+tileSize*3 && positionY > window.innerHeight - tileSize*11-2 && positionY < window.innerHeight - tileSize*11-2 + tileSize*3){ // handling panning left
            keysPressed['bA'] = true;
            buttonPressed = true;
        }else if(positionX > 5 + tileSize*3*2 && positionX < 5+tileSize*3+tileSize*3*2 && positionY > window.innerHeight - tileSize*11-2 && positionY < window.innerHeight - tileSize*11-2 + tileSize*3){ // handling panning right
            keysPressed['bD'] = true;
            buttonPressed = true;
        }else if(positionX > 5 + tileSize*3 && positionX < 5+tileSize*3*2 && positionY > window.innerHeight - tileSize*11-2 - tileSize*3 && positionY < window.innerHeight - tileSize*11-2){ // handling panning up
            keysPressed['bW'] = true;
            buttonPressed = true;
        }else if(positionX > 5 + tileSize*3 && positionX < 5+tileSize*3*2 && positionY > window.innerHeight - tileSize*11-2 + tileSize*3 && positionY < window.innerHeight - tileSize*11-2 + tileSize*3*2){ // handling panning down
            keysPressed['bS'] = true;
            buttonPressed = true;
        }else if(positionX > window.innerWidth - tileSize*4 - tileSize - getRightOffset() && positionX < window.innerWidth - tileSize - 2 - getRightOffset() && positionY > window.innerHeight - tileSize*11-2 && positionY < window.innerHeight - tileSize*11-2 + tileSize*3){ // handling the add/rem button
            buttonPressed = true;
            add = !add;
        }else if(window.innerWidth < 768 && positionX > window.innerWidth - tileSize*12 - getRightOffset() && positionX < window.innerWidth - tileSize - 2 - getRightOffset() && positionY > window.innerHeight - tileSize*5 && positionY < window.innerHeight - tileSize*5 + tileSize*3){ // handling the scroll to menu button
            scrollToMenu();
        }else if(positionX > 5 && positionX < 5 + tileSize*3.5 && positionY > tileSize*11-2 && positionY < tileSize*11-2 + tileSize*5){ // handling the reseting type button
            selectedType = {name: "Nothing"};
        }
    }
    if(currentTool === "Selector"&&!buttonPressed){ // this is the part that creates the selection box
        let mx, my;
        if(event.touches){
            if(event.touches[1]){
                mx = event.touches[1].pageX;
                my = event.touches[1].pageY;
            }else{
                mx = event.touches[0].pageX;
                my = event.touches[0].pageY;
            }
        }else{
            mx = event.pageX;
            my = event.pageY;
        }
        selectionGridInformation.x1 = (mx - width/2 - offsetX)/zoom + (tileSize*gridSizeX)/2;
        selectionGridInformation.y1 = (my - height/2 - offsetY)/zoom + (tileSize*gridSizeY)/2;
        selectionGridInformation.x2 = (mx - width/2 - offsetX)/zoom + (tileSize*gridSizeX)/2;
        selectionGridInformation.y2 = (my - height/2 - offsetY)/zoom + (tileSize*gridSizeY)/2;
        selectionGrid(event); // call it once to set the initial position
        if (!event.touches) {

            const moveHandler = (moveEvent) => {
                selectionGrid(moveEvent);
            };

            const upHandler = (event) => {
                stopSelection(event);
                window.removeEventListener('mousemove', moveHandler);
                window.removeEventListener('mouseup', upHandler);
            };

            window.addEventListener('mousemove', moveHandler);
            window.addEventListener('mouseup', upHandler);

        } else {

            const moveHandler = (moveEvent) => {
                selectionGrid(moveEvent);
            };

            const endHandler = (event) => {
                stopSelection(event);
                window.removeEventListener('touchmove', moveHandler);
                window.removeEventListener('touchend', endHandler);
            };

            window.addEventListener('touchmove', moveHandler);
            window.addEventListener('touchend', endHandler);
        }
} else if (currentTool === "Panning" && !buttonPressed) {
    let startX = event.pageX;
    let startY = event.pageY;
    function pan(event) {
        offsetX += event.pageX - startX;
        offsetY += event.pageY - startY;
        startX = event.pageX;
        startY = event.pageY;
        }
        function stopPan() {
            window.removeEventListener('mousemove', pan);
            window.removeEventListener('mouseup', stopPan);
        }
        window.addEventListener('mousemove', pan);
        window.addEventListener('mouseup', stopPan);
    }
}

function selectTool(tool) { // function for selecting a tool from the side panel
    currentTool = tool;
    if(currentTool === "" || currentTool === null){
        currentTool = "Selector";
    }
}

function drawGrid(){ // function for drawing the grid on the canvas
    stroke(200);
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
    text("Current Tool: " + currentTool, 5, window.innerHeight - 20);
    // displaying selected tile type
    const element = document.getElementById('drawingArea');
    text("Selected Type: " + selectedType.name, element.offsetWidth - textWidth("Selected Type: " + selectedType.name)-20, window.innerHeight - 20);
    // if the screen has touch
    if(isTouch) {
        fill(255);
        // zooming buttons
        rect(5, window.innerHeight - tileSize*5, tileSize*12, tileSize*3);
        fill(0, 0, 0);
        let fontSize = 20;
        while(fontSize > 7 && textWidth("Zoom In: + | Zoom Out: -") > tileSize*12 - 10) {
            fontSize--;
            textSize(fontSize);
        }
        textAlign(CENTER, CENTER);
        text("Zoom In: +    Zoom Out: -", tileSize*12/2+5, window.innerHeight - tileSize*3.5);
        line(tileSize*12/2, window.innerHeight - tileSize*5 + 5, tileSize*12/2, window.innerHeight - tileSize*5 + tileSize*3 - 5);
        // showing the panning buttons
        fill(255);
        // left pan button
        rect(5, window.innerHeight - tileSize*11-2, tileSize*3, tileSize*3);
        // right pan button
        rect(5+tileSize*3*2, window.innerHeight - tileSize*11-2, tileSize*3, tileSize*3);
        // up pan button
        rect(5+tileSize*3, window.innerHeight - tileSize*14-2, tileSize*3, tileSize*3);
        // down pan button
        rect(5+tileSize*3, window.innerHeight - tileSize*8-2, tileSize*3, tileSize*3);
        // change add/rem button
        rect(window.innerWidth - tileSize*4 - tileSize - getRightOffset(), window.innerHeight - tileSize*11-2, tileSize*4, tileSize*3);
        // scroll to menu button
        if(window.innerWidth < 768) {
            rect(window.innerWidth - tileSize*12 - getRightOffset(), window.innerHeight - tileSize*5, tileSize*11-2, tileSize*3);
        }
        // reseting selected type button
        rect(5, tileSize*11-2, tileSize*3.5, tileSize*5);
        // texts for the buttons
        fill(0);
        // panning texts
        text("<<", 5 + tileSize*3/2, window.innerHeight - tileSize*11-2 + tileSize*3/2);
        text(">>", 5 + tileSize*3*2 + tileSize*3/2, window.innerHeight - tileSize*11-2 + tileSize*3/2);
        text("↑", 5 + tileSize*4.5, window.innerHeight - tileSize*14-2 + tileSize*3/2);
        text("↓", 5 + tileSize*4.5, window.innerHeight - tileSize*8-2 + tileSize*3/2);
        // control texts
        text(add == true ? "Add" : "Rem", window.innerWidth - tileSize*3.5 - tileSize + tileSize*3/2 - getRightOffset(), window.innerHeight - tileSize*11-2 + tileSize*3/2);
        if(window.innerWidth < 768) {
            text("Scroll to Menu", window.innerWidth - tileSize*12 + tileSize*11/2 - getRightOffset(), window.innerHeight - tileSize*3.5);
        }
        text("Reset\nType", 5 + tileSize*3.5/2, tileSize*11-2 + tileSize*5/2);
    }
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

function drawZones(){ // function for drawing the zones on the canvas
    mapTiles.forEach(tile => {
        if(tile.zones.length > 0){
            tile.zones.forEach(zone => {
                if(zone.name === selectedType.name){
                    push();
                    translate(-gridSizeX * tileSize / 2, -gridSizeY * tileSize / 2);
                    strokeWeight(2);
                    fill(zone.color);
                    triangle(tile.x + tile.size/2, tile.y + tile.size/4, tile.x + tile.size/4, tile.y + 3*tile.size/4, tile.x + 3*tile.size/4, tile.y + 3*tile.size/4);
                    pop();
                }
            });
        }
    });
}

function setup(){ // called once by p5.js when the page loads
    let div = document.getElementById('drawingArea');
    let width = div.offsetWidth;
    let canvas = createCanvas(width, window.innerHeight);
    canvas.parent('drawingArea');
    tileSize = document.getElementById('drawingArea').offsetWidth / 30;
    createGrid();
    resizeEditor(); // has to be called once at the start otherwise the entire window is for no reason moved slightly to the right
}


function draw(){ // called 60 times a second by p5.js
    update(); // updating the offsets based on key presses
    push();
    background(0, 0,255);
    translate(width / 2 + offsetX, height / 2 + offsetY); // centering the canvas
    scale(zoom); // applying the zoom to the canvas
    drawGrid(); // draws the rows and the columns
    drawTiles(); // draws the tiles
    drawSelection(); // highlights the selected tiles
    drawSelectionGrid(); // draws the selection grid
    drawZones(); // draws the zones
    pop();
    drawInformation(); // draws important UI elements
}