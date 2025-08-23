// this file is for testing the zooming function of p5.js canvas since I dont quite understand how it works

let zoom = 1;
let offsetX = 0;
let offsetY = 0;

function setup(){ // called once by p5.js
    let canvas = createCanvas(window.innerWidth, window.innerHeight);
    canvas.parent('drawingArea');
}

window.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (event.deltaY < 0) {
        zoom *= 1.1;
    } else {
        zoom /= 1.1;
    }
}, { passive: false });

window.addEventListener("keydown", (event) => {
    if (event.key === "w") {
        offsetY -= 10;
    } else if (event.key === "a") {
        offsetX -= 10;
    } else if (event.key === "s") {
        offsetY += 10;
    } else if (event.key === "d") {
        offsetX += 10;
    }
});

function draw(){
    push();
    background(220);
    translate(width / 2 + offsetX, height / 2 + offsetY);
    scale(zoom);
    ellipse(0, 0, 50, 50);
    pop();

    textSize(32);
    fill(0);
    text("Zoom Level: " + zoom.toFixed(2) + ", OffsetX: " + offsetX + ", OffsetY: " + offsetY, 10, 30);
}