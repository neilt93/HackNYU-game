import Phaser from "phaser";

export default class GameScene extends Phaser.Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private enemies!: Phaser.Physics.Arcade.Group;
    private keys!: { [key: string]: Phaser.Input.Keyboard.Key };
    private slash!: Phaser.GameObjects.Sprite;
    private bullets!: Phaser.Physics.Arcade.Group; // Bullet group
    private lastDirection: string = "right"; // Default direction
    private playerHealth = 100;
    private playerMaxHealth = 100;
    private playerHealthBar!: Phaser.GameObjects.Graphics;
    private enemyHealth: Map<Phaser.Physics.Arcade.Sprite, Phaser.GameObjects.Graphics> = new Map();
    private maxEnemyHealth = 20;



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
        this.physics.add.collider(this.bullets, wallLayer, this.handleBulletWallCollision, undefined, this);

        // Player and enemy collision
        this.physics.add.overlap(
            this.player,
            this.enemies,
            (player, enemy) => this.handlePlayerCollision(player, enemy),
            undefined,
            this
        );


        // Bullet and enemy collision
        this.physics.add.overlap(
            this.bullets,
            this.enemies,
            (bullet, enemy) => this.handleBulletHit(bullet as Phaser.Physics.Arcade.Sprite, enemy as Phaser.Physics.Arcade.Sprite),
            undefined,
            this
        );

        // Slash and enemy collision
        this.physics.add.overlap(
            this.slash,
            this.enemies,
            (slash, enemy) => this.handleBulletHit(slash as Phaser.Physics.Arcade.Sprite, enemy as Phaser.Physics.Arcade.Sprite),
            undefined,
            this
        );

        // Health bar
        this.createPlayerHealthBar();


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

        this.physics.add.overlap(this.slash, this.enemies, (slash, enemy) => {
            let enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
            let enemyHealthBar = this.enemyHealth.get(enemySprite);

            if (!enemyHealthBar) return;

            let newHealth = (enemySprite.getData("health") || this.maxEnemyHealth) - 1; // Reduce health
            enemySprite.setData("health", newHealth);

            if (newHealth <= 0) {
                enemySprite.destroy();
                enemyHealthBar.destroy();
                this.enemyHealth.delete(enemySprite);
            } else {
                this.updateEnemyHealthBar(enemySprite, enemyHealthBar, newHealth);
            }
        });

        // Update health bars of enemies
        this.enemies.getChildren().forEach((enemy) => {
            let enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
            this.physics.moveToObject(enemySprite, this.player, 100);

            let healthBar = this.enemyHealth.get(enemySprite);
            if (healthBar) {
                this.updateEnemyHealthBar(enemySprite, healthBar, enemySprite.getData("health"));
            }
        });

        // Update player health bar position (stays at the top)
        this.updatePlayerHealthBar();
    }

    spawnEnemy() {
        let enemy = this.enemies.create(
            Phaser.Math.Between(50, 750),
            Phaser.Math.Between(50, 550),
            "tiles_sprites",
            110
        ) as Phaser.Physics.Arcade.Sprite;

        enemy.setScale(1);
        enemy.setData("health", this.maxEnemyHealth); // Store enemy health data

        let healthBar = this.add.graphics();
        this.updateEnemyHealthBar(enemy, healthBar, this.maxEnemyHealth);

        this.enemyHealth.set(enemy, healthBar);
    }


    // Player collision
    private isInvincible: boolean = false; // Track invincibility state

    handlePlayerCollision(
        player: Phaser.GameObjects.GameObject | Phaser.Physics.Arcade.Sprite,
        enemy: Phaser.GameObjects.GameObject | Phaser.Physics.Arcade.Sprite
    ) {
        const playerSprite = player as Phaser.Physics.Arcade.Sprite;
        const enemySprite = enemy as Phaser.Physics.Arcade.Sprite;

        if (this.isInvincible) return; // 🔥 Skip damage if invincible

        // 🔥 Reduce player health
        this.playerHealth -= 1;
        console.log(`Player hit! Health: ${this.playerHealth}`);

        // 🔥 Update health bar
        this.updatePlayerHealthBar();

        // ✅ If player health reaches 0, trigger game over
        if (this.playerHealth <= 0) {
            console.log("Game Over!");
            this.scene.restart(); // Reset the game
            return;
        }

        // 🔥 Activate Invincibility
        this.isInvincible = true;
        this.tweens.add({
            targets: playerSprite,
            alpha: 0.2,
            duration: 100,
            yoyo: true,
            repeat: 1,
            onComplete: () => {
                playerSprite.setAlpha(1);
                this.isInvincible = false; // ✅ Reset invincibility
            }
        });
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
    handleBulletWallCollision(bullet: Phaser.GameObjects.GameObject) {
        let bulletSprite = bullet as Phaser.Physics.Arcade.Sprite;
        bulletSprite.destroy(); // Destroy bullet upon hitting the wall
        console.log("Bullet hit wall and was destroyed!");
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

        this.physics.add.overlap(slash, this.enemies, (slashObj, enemy) => {
            let enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
            let enemyHealthBar = this.enemyHealth.get(enemySprite);

            if (!enemyHealthBar) return;

            // 🔥 Get current enemy health
            let currentHealth = enemySprite.getData("health") || this.maxEnemyHealth;

            // 🔥 Reduce enemy health by 1
            let newHealth = currentHealth - 1;
            enemySprite.setData("health", newHealth);

            console.log(`Enemy hit! New Health: ${newHealth}`);

            if (newHealth <= 0) {
                // 🔥 Destroy enemy and health bar
                enemySprite.destroy();
                enemyHealthBar.destroy();
                this.enemyHealth.delete(enemySprite);

                // ✅ Respawn enemy after 1 second
                this.time.delayedCall(1000, () => {
                    this.spawnEnemy();
                });
            } else {
                // 🔥 Update enemy health bar
                this.updateEnemyHealthBar(enemySprite, enemyHealthBar, newHealth);
            }
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
        bullet.setScale(0.1); // Resize bullet

        // Enable physics body
        this.physics.world.enable(bullet);

        let velocityX = 0;
        let velocityY = 0;
        let angle = 0; // Rotation angle

        switch (this.lastDirection) {
            case "up":
                velocityY = -400;
                bullet.setPosition(this.player.x, this.player.y - 16);
                angle = -90; // Facing up
                break;
            case "down":
                velocityY = 400;
                bullet.setPosition(this.player.x, this.player.y + 16);
                angle = 90; // Facing down
                break;
            case "left":
                velocityX = -400;
                bullet.setPosition(this.player.x - 16, this.player.y);
                angle = 180; // Facing left
                break;
            case "right":
            default:
                velocityX = 400;
                bullet.setPosition(this.player.x + 16, this.player.y);
                angle = 0; // Facing right
                break;
        }

        bullet.setVelocity(velocityX, velocityY);
        bullet.setAngle(angle); // Rotate bullet

        // Destroy bullet after 1 second if it doesn't hit anything
        this.time.delayedCall(1000, () => {
            if (bullet.active) {
                bullet.destroy();
            }
        });
    }

    createPlayerHealthBar() {
        this.playerHealthBar = this.add.graphics();
        this.updatePlayerHealthBar();
    }

    updatePlayerHealthBar() {
        this.playerHealthBar.clear();
        this.playerHealthBar.fillStyle(0x000000, 1);
        this.playerHealthBar.fillRect(10, 10, 200, 10); // Background

        this.playerHealthBar.fillStyle(0x00ff00, 1); // Green for health
        this.playerHealthBar.fillRect(10, 10, (this.playerHealth / this.playerMaxHealth) * 200, 10);
    }

    // Update enemy health bar
    updateEnemyHealthBar(enemy: Phaser.Physics.Arcade.Sprite, healthBar: Phaser.GameObjects.Graphics, health: number) {
        healthBar.clear();
        healthBar.fillStyle(0x000000, 1);
        healthBar.fillRect(enemy.x - 10, enemy.y - 15, 20, 4);

        healthBar.fillStyle(0xff0000, 1);
        healthBar.fillRect(enemy.x - 10, enemy.y - 15, (health / this.maxEnemyHealth) * 20, 4);
    }



}
