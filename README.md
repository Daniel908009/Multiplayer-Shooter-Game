# Multiplayer-Shooter-Game

## What is it?
This project is exactly what the name suggests: a multiplayer online game with a frontend made with Bootstrap 5 and p5.js, and a backend made with Node.js. 
Originally, I wanted to make a simple game without any map panning — meaning my goal was to load small maps where all the players could see everything. Kind of like the game Stick Fight.

But during development I realized that it was too easy, and the result would be kinda meh since I’m not an artist, so all the graphics would always look horrible. Because of that, I decided to increase the project’s quality by doing more interesting things in the code (like loading parts of a bigger map based on the distance that the player can see).

Because of that decision, this project is basically split into two parts:
- the actual game
- the map designer, which is used to create maps that can later be loaded and played in the game

Live deployment:❗ Important: Live deployment is currently not available. I wasn’t aware that my student status needed to be verified beforehand in order to use Hack Club’s Nest. I’ll apply now, but it’s unlikely I’ll get it deployed in time for the end of the Summer of Making. As a temporary fix, I recorded two videos showcasing this project.
The Game video link: - [Game video](https://www.youtube.com/watch?v=t6db3MScNCg)
The Map Designer video link: - [Map Designer video](https://www.youtube.com/watch?v=HJtbwzE4uG4)

# Current state of the game
Right now the game is in a very basic state. The actual game does work, but there isn’t much content yet — for example, there is only one type of gun and the only other item is a medkit.

Things like dynamic speed (based on what the player is standing on), walls and boundaries and showing parts of the map based on players vision are implemented though.

On the other hand, the map designer is pretty much complete. It has all of the necessary features and more — for example, it works on mobile too. I also think it’s easily upgradable in case I start adding more features (see the **Features** part of this readme).

## Why did I do it?
I wanted to gain better experience with multiplayer online games, particularly with anti-cheat aspects. Basically, I wanted to learn how to run most of the game logic on the server side while making the client just a terminal that can’t influence the game loop in a cheaty way.

## How to play
❗ Important: First read the **Current state of the game** section of this readme

### Game controls
- **W, A, S, D** for movement
- **E** to pick up items
- **Left click** to use items (some have specific conditions, e.g. you can’t use a medkit if you already have full health)
- **Right click** to drop the item in the currently selected slot (highlighted by the yellow square)
- **Scroll wheel** or **number keys** to switch the currently selected item slot

### Map designer controls
- **Left click** to select tiles (you can also click and drag)
- **Right click** to unselect currently selected tiles
- **Shift + left click** to unselect specific tiles (you can also drag)
- **Shift + right click** to reset the selected type to nothing
- **Scroll wheel** to zoom
- **W, A, S, D** to pan/move
- All the different tile types are in the menu on the right/bottom (depending on your screen size)
- You can see the currently selected type on the editors map window

Keep in mind:
- When you select a zone type (e.g. “Health”), all the other zone types hide themselves.
- Zones are places where certain items have a chance of spawning.

The map designer also works on mobile, but most of the controls are handled using buttons that only appear on mobile screens. They’re pretty intuitive, so I won’t describe them here.

## Features
❗ Important: I tried to write the features in chronological order. However, sometimes I work on multiple things at once, or I may add features later, so this list is just a prediction of how I imagine development going. I also for sure forgot some already achieved goals so if you want to know all the features that are in, you will have to read the commits or the actual code.

- [X] Basic project structure (main menu, game, and editor files)
- [X] Fully functioning main menu with working modals and buttons
- [X] Lobby creation on the server side and a basic lobby waiting menu
- [X] Map designer with all the basic functions (selecting/changing types,panning, etc.)
- [X] Saving of designed maps (to a file, local storage, or copying box)
- [X] Map designer for mobile/touch screens
- [X] Advanced lobby waiting menu with more features (like selecting maps to play)
- [X] Map handling on the server side (loading/preloading things like items) and sending visible parts of the map to clients via a game loop
- [X] Synchronizing and showing players to each other
- [X] Basic items (a pistol and a medkit)
- [X] Handling bullets on both server and client sides
- [X] Walls and boundaries
- [X] Game UI (inventory, player names, and health tags)
- [ ] Grenades (partially in the code, but currently cause crashes)
- [ ] Special effects (explosions, footsteps, etc. — tricky since they must be server-side)
- [ ] More weapons/items and a better system for handling them
- [ ] Loading into a map by jumping from something (like an airplane) instead of spawning directly (airplane direction should also be random)
- [ ] More zones (e.g. tree spawning zone)
- [ ] Certain weapons/items can be disabled from spawning
- [ ] Better visuals (improve the designer, allow custom tiles/zones) 
- [ ] Sound effects
- [ ] Minimap and big map (opened with **M**)

### Very late development features
- [ ] AI bot enemies (this should be a lot of fun in JS /sarcasm)
- [ ] Vehicles that can be driven
- [ ] Map design using math (e.g. Perlin noise)
- [ ] In-game chat
- [ ] Renaming this project since the current name is only good for a Github repo

## Screenshots
### Each screenshot has a description below it so you can understand what you are seeing.

<img width="2239" height="1244" alt="image" src="https://github.com/user-attachments/assets/9e5a9f37-ae0d-4269-89a4-e4bbf40dbb7c" />
This is the main menu.

<img width="2243" height="1250" alt="image" src="https://github.com/user-attachments/assets/8ba6a1fc-0d46-45d8-ac06-6b405887c522" />
This is how the waiting room looks when you join a lobby.

<img width="2247" height="1254" alt="image" src="https://github.com/user-attachments/assets/bc127c3c-8e4c-47a1-963d-a7f578643148" />
This is how the game looks once it starts.

<img width="2249" height="1256" alt="image" src="https://github.com/user-attachments/assets/c0eba58d-c470-4ffb-a61e-96cb18c0ff18" />
This is how the map designer looks on pc.

![Screenshot_2025-09-30-17-09-40-983_com android chrome](https://github.com/user-attachments/assets/278f1610-7b38-43cb-baea-93e4907774a7)
This is how the map designer looks on mobile.

## How to download and run locally
❗ Important: This project requires Node.js.

If you want to download this project, I recommend picking the latest release from this repository (releases are listed on the right side when opened, usually named something like `v1.0`).

Steps:
1. Download the release you want (in most cases: **Source code (zip)**).
2. Extract the files to your preferred location.
3. Open a terminal in that folder and run:
   ```bash
   npm install
   node server.js
   ```
