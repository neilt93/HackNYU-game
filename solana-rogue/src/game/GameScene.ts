import Phaser from "phaser";

export default class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private keys!: { [key: string]: Phaser.Input.Keyboard.Key };
  private slash!: Phaser.GameObjects.Sprite;
  private bullets!: Phaser.Physics.Arcade.Group; // Bullet group
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

    // Bullet image
    this.load.image("bullet", "/assets/bullet.png");
  }

  create() {
    // Create the tilemap
    const map = this.make.tilemap({ key: "map" });
    const tileset = map.addTilesetImage("Dungeon", "tiles")!;
    
    const groundLayer = map.createLayer("Ground", tileset, 0, 0)!;
    const wallLayer = map.createLayer("Walls", tileset, 0, 0)!;

    // Player setup
    this.player = this.physics.add.sprite(400, 300, "tiles_sprites", 96);
    this.player.setCollideWorldBounds(true);

    // Enemy group
    this.enemies = this.physics.add.group();
    this.spawnEnemy();

    // Bullet group
    this.bullets = this.physics.add.group({
      defaultKey: "bullet",
      maxSize: 10,
      runChildUpdate: true
    });

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
        { key: "slash1" }, { key: "slash2" }, { key: "slash3" }, { key: "slash4" },
        { key: "slash5" }, { key: "slash6" }, { key: "slash7" }, { key: "slash8" },
        { key: "slash9" }
      ],
      frameRate: 20,
      repeat: 0
    });

    wallLayer.setCollisionByExclusion([-1]);
    this.physics.add.collider(this.player, wallLayer);
    this.physics.add.collider(this.enemies, wallLayer);

    // Bullet and enemy collision
    this.physics.add.overlap(
        this.bullets,
        this.enemies,
        (bullet, enemy) => this.handleBulletHit(bullet as Phaser.Physics.Arcade.Sprite, enemy as Phaser.Physics.Arcade.Sprite),
        undefined,
        this
    );

    this.physics.add.overlap(
        this.slash,
        this.enemies,
        (slash, enemy) => this.handleBulletHit(slash as Phaser.Physics.Arcade.Sprite, enemy as Phaser.Physics.Arcade.Sprite),
        undefined,
        this
    );

    // Keyboard input
    this.keys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SPACE: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      F: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F),
    };

    // Bind Slash and Shooting
    this.keys.SPACE.on("down", () => this.performSlash());
    this.keys.F.on("down", () => this.shootBullet());
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

private isSlashing: boolean = false; // Track if a slash is active

performSlash() {
    if (this.isSlashing) return; // Prevent multiple slashes at once
    this.isSlashing = true;

    let slash = this.physics.add.sprite(this.player.x, this.player.y, "slash1");
    slash.setDepth(15);
    slash.setOrigin(0.5, 0.5);
    slash.setSize(16, 16);

    let angle = 0;

    switch (this.lastDirection) {
        case "up":
            slash.setPosition(this.player.x, this.player.y - 16);
            angle = -90;
            break;
        case "down":
            slash.setPosition(this.player.x, this.player.y + 16);
            angle = 90;
            break;
        case "left":
            slash.setPosition(this.player.x - 16, this.player.y);
            angle = 180;
            break;
        case "right":
        default:
            slash.setPosition(this.player.x + 16, this.player.y);
            angle = 0;
            break;
    }

    slash.setAngle(angle);

    // Play slash animation (ensure it exists)
    if (this.anims.exists("slash_anim")) {
        slash.play("slash_anim");
    } else {
        console.error("Slash animation missing!");
    }

    // Check for enemy hits while the slash is active
    this.physics.add.overlap(slash, this.enemies, (slashObj, enemy) => {
        let enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
        enemySprite.destroy();
        console.log("Enemy hit!");

        // Respawn an enemy after a delay
        this.time.delayedCall(1000, () => {
            this.spawnEnemy();
        });
    });

    // Destroy the slash after the animation finishes and reset isSlashing
    slash.on("animationcomplete", () => {
        slash.destroy();
        this.isSlashing = false; // Allow new slashes
    });

    // Safety reset in case animationcomplete doesn't trigger
    this.time.delayedCall(500, () => {
        if (slash.active) {
            slash.destroy();
        }
        this.isSlashing = false; // Reset slashing state
    });
}




handleBulletHit(bullet: Phaser.GameObjects.GameObject, enemy: Phaser.GameObjects.GameObject) {
    bullet.destroy();
    enemy.destroy();
    console.log("Enemy shot!");

    this.time.delayedCall(1000, () => {
      this.spawnEnemy();
    });
  }

  shootBullet() {
    let bullet = this.bullets.get(this.player.x, this.player.y, "bullet");

    if (!bullet) return;

    bullet.setActive(true);
    bullet.setVisible(true);
    bullet.setScale(0.1);

    let velocityX = 0;
    let velocityY = 0;

    switch (this.lastDirection) {
      case "up":
        velocityY = -300;
        bullet.setPosition(this.player.x, this.player.y - 16);
        break;
      case "down":
        velocityY = 300;
        bullet.setPosition(this.player.x, this.player.y + 16);
        break;
      case "left":
        velocityX = -300;
        bullet.setPosition(this.player.x - 16, this.player.y);
        break;
      case "right":
      default:
        velocityX = 300;
        bullet.setPosition(this.player.x + 16, this.player.y);
        break;
    }

    bullet.setVelocity(velocityX, velocityY);

    // Destroy bullet after 1000ms
    this.time.delayedCall(1000, () => {
      bullet.destroy();
    });
  }

}
