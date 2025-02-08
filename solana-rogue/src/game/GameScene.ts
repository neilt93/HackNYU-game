import Phaser from "phaser";

export default class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private keys!: { [key: string]: Phaser.Input.Keyboard.Key };
  private slash!: Phaser.GameObjects.Sprite;
  private lastDirection: string = "right"; // Default direction

  constructor() {
    super({ key: "GameScene" });
  }

  preload() {
    this.load.tilemapTiledJSON("map", "/assets/dungeon_map.tmj"); // Load Tilemap JSON
    this.load.image("tiles", "/assets/kenney_tiny-dungeon/Tilemap/tilemap.png");
    this.load.spritesheet("tiles_sprites", "assets/kenney_tiny-dungeon/Tilemap/tilemap.png", {
        frameWidth: 16,
        frameHeight: 16,
        spacing: 1,
    });

    // Green slash
    for (let i = 1; i <= 9; i++) {
        this.load.image(`slash${i}`, `/assets/Pixel Art Animations - Slashes/Slash 1/color1/Frames/Slash_color1_frame${i}.png`);
    }   
  }

  create() {
    // Create the tilemap FIRST
    const map = this.make.tilemap({ key: "map" });
    const tileset = map.addTilesetImage("Dungeon", "tiles")!;
    
    const groundLayer = map.createLayer("Ground", tileset, 0, 0)!;
    const wallLayer = map.createLayer("Walls", tileset, 0, 0)!;

    // Create the player and enemies AFTER the map
    this.player = this.physics.add.sprite(400, 300, "tiles_sprites", 96);
    this.player.setCollideWorldBounds(true);

    // Create enemy group
    this.enemies = this.physics.add.group();
    this.spawnEnemy();

    wallLayer.setCollisionByExclusion([-1]); // Enable collisions on walls
    this.physics.add.collider(this.player, wallLayer); // Stop player on walls
    this.physics.add.collider(this.enemies, wallLayer); // Stop player on walls

    // Collision detection
    this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
        this.handlePlayerCollision(player as Phaser.Physics.Arcade.Sprite, enemy as Phaser.Physics.Arcade.Sprite);
    });

    // Ensure sprites are above the tilemap
    this.player.setDepth(10);

    // Slash should be a physics sprite to have a body
    this.slash = this.physics.add.sprite(0, 0, "slash1").setVisible(false);
    this.slash.setDepth(15);
    this.slash.setOrigin(0.5, 0.5);
    this.slash.setSize(16, 16);  // Set hitbox size
    this.slash.setActive(false);
    (this.slash.body as Phaser.Physics.Arcade.Body).setImmovable(true); // Prevents movement


    // Slash Animation
    this.anims.create({
        key: "slash_anim",
        frames: [
            { key: "slash1" },
            { key: "slash2" },
            { key: "slash3" },
            { key: "slash4" },
            { key: "slash5" },
            { key: "slash6" },
            { key: "slash7" },
            { key: "slash8" },
            { key: "slash9" }
        ],
        frameRate: 20,
        repeat: 0
    });

    // Set up keyboard input
    this.keys = {
        W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        SPACE: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };

    // Bind Slash Attack
    this.keys.SPACE.on("down", () => {
        this.performSlash();
    });
}


  update() {
    let speed = 200;
    let velocityX = 0;
    let velocityY = 0;

    if (this.keys.A.isDown) {
        velocityX = -speed;
        this.lastDirection = "left";
    }
    if (this.keys.D.isDown) {
        velocityX = speed;
        this.lastDirection = "right";
    }
    if (this.keys.W.isDown) {
        velocityY = -speed;
        this.lastDirection = "up";
    }
    if (this.keys.S.isDown) {
        velocityY = speed;
        this.lastDirection = "down";
    }

    // Normalize diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
        velocityX *= 0.707;
        velocityY *= 0.707;
    }

    this.player.setVelocity(velocityX, velocityY);

    // 🔥 Ensure enemies are always moving toward the player
    this.enemies.getChildren().forEach((enemy) => {
        let enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
        this.physics.moveToObject(enemySprite, this.player, 100); // ✅ Ensures enemy constantly moves
    });
}

  spawnEnemy() {
    let enemy = this.enemies.create(
        Phaser.Math.Between(50, 750), 
        Phaser.Math.Between(50, 550), 
        "tiles_sprites", 
        110 // Change this index to match the enemy tile
    );
    enemy.setScale(1); // Adjust size if needed
}

  handlePlayerCollision(player: Phaser.GameObjects.GameObject, enemy: Phaser.GameObjects.GameObject) {
    const playerSprite = player as Phaser.Physics.Arcade.Sprite;
    const enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
  
    console.log("Player hit by enemy!");
    enemySprite.destroy(); // Remove enemy on collision
  }

  handleEnemyHit(enemy: Phaser.Physics.Arcade.Sprite) {
    if (this.slash.visible) {
        console.log("Enemy hit!");
        enemy.destroy();

        // Respawn enemy after 1 second
        this.time.delayedCall(1000, () => {
            this.spawnEnemy();
        });
    }
}

performSlash() {
    if (!this.slash) return; // Ensure slash exists

    this.slash.setVisible(true);
    this.slash.setActive(true);
    
    let angle = 0; 

    switch (this.lastDirection) {
        case "up":
            angle = -90;
            this.slash.setPosition(this.player.x, this.player.y - 16);
            break;
        case "down":
            angle = 90;
            this.slash.setPosition(this.player.x, this.player.y + 16);
            break;
        case "left":
            angle = 180;
            this.slash.setPosition(this.player.x - 16, this.player.y);
            break;
        case "right":
        default:
            angle = 0;
            this.slash.setPosition(this.player.x + 16, this.player.y);
            break;
    }

    this.slash.setAngle(angle);
    this.slash.play("slash_anim");

    // Enable collisions while slash is active
    this.physics.add.overlap(this.slash, this.enemies, (slash, enemy) => {
        let enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
        enemySprite.destroy();
        console.log("Enemy hit!");
    });

    // Hide the slash after animation
    this.time.delayedCall(450, () => {
        this.slash.setVisible(false);
        this.slash.setActive(false);
    });
}

}
