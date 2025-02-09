import Phaser from "phaser";
import { connectWallet, getWalletPublicKey, getWalletBalance, sendScoreToSolana } from "../utils/solana";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

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
    private score: number = 0;
    private scoreText!: Phaser.GameObjects.Text;
    private knockbackStrength = 250; // Knockback speed when hit
    private knockbackDuration = 200; // How long the enemy is pushed (ms)
    private coins!: Phaser.Physics.Arcade.Group;
    private walletPublicKey: string | null = null;
    private balanceText!: Phaser.GameObjects.Text;
    private walletText!: Phaser.GameObjects.Text;
    private connectButton!: Phaser.GameObjects.Text;
    private enemySpawnEvent!: Phaser.Time.TimerEvent; // Store reference to spawn event



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

        this.load.spritesheet("coin", "/assets/coin.png", {
            frameWidth: 16, // Frame size for each coin
            frameHeight: 16,
        });


        // Green slash
        for (let i = 1; i <= 9; i++) {
            this.load.image(`slash${i}`, `/assets/Pixel Art Animations - Slashes/Slash 1/color1/Frames/Slash_color1_frame${i}.png`);
        }

        // Bullet image
        this.load.image("bullet", "/assets/bullet.png");
    }

    private enemySpawnRate = 2000; // 🔥 Time between enemy spawns (3 seconds)
    private maxEnemies = 10; // 🔥 Limit the max enemies at once

    create() {
        // 🔵 Create Background Rectangle for Button
        const buttonBg = this.add.rectangle(10 + 80, 50 + 10, 180, 30, 0x0000ff)
            .setOrigin(0.5)
            .setScrollFactor(0); // Prevents it from moving
        // 🎮 Wallet Connect Button
        this.connectButton = this.add.text(10, 50, "🔗 Connect Wallet", {
            fontSize: "16px",
            color: "#ffffff",
            padding: { x: 5, y: 2 }
        })
            .setInteractive()
            .setDepth(1000)  // Ensure it's on top
            .setScrollFactor(0)
            .on("pointerdown", async () => {
                const wallet = await connectWallet();
                if (wallet) {
                    console.log("✅ Connected Wallet:", wallet);
                    this.walletPublicKey = wallet;
                    this.walletText.setText(`Wallet: ${wallet.substring(0, 6)}...`);
                    this.fetchBalance();
                }
            });

        // 💰 Display Wallet Address
        this.walletText = this.add.text(10, 70, "Wallet: Not Connected", {
            fontSize: "14px",
            color: "#ffffff"
        }).setScrollFactor(0);

        console.log("✅ Connect Button Created:", this.connectButton);


        // 💵 Display Balance
        this.balanceText = this.add.text(10, 90, "Balance: -- SOL", {
            fontSize: "14px",
            color: "#ffffff"
        }).setScrollFactor(0);


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
        this.slash.setSize(50, 50); // Adjust this to your needs
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

        // Coin
        this.coins = this.physics.add.group({
            defaultKey: "coin"
        });

        // Coin animation
        this.anims.create({
            key: "coin_spin",
            frames: this.anims.generateFrameNumbers("coin", { start: 0, end: 15 }),
            frameRate: 10,
            repeat: -1
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

        // Score
        this.scoreText = this.add.text(10, 30, `Score: ${this.score}`, {
            fontSize: "16px",
            color: "#ffffff",
            backgroundColor: "#000000",
            padding: { x: 5, y: 2 }
        });
        this.scoreText.setScrollFactor(0); // Keep it fixed on screen

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

        // Automatically spawn enemies at a fixed interval
        this.enemySpawnEvent = this.time.addEvent({
            delay: this.enemySpawnRate,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true // 🔥 Ensures continuous spawning
        });
    }


    update() {
        if (this.physics.world.isPaused) return; // ✅ Stops updating if game is over

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

            let newHealth = (enemySprite.getData("health") || this.maxEnemyHealth) - 80; // Reduce health
            enemySprite.setData("health", newHealth);

            if (newHealth <= 0) {
                enemySprite.destroy();
                enemyHealthBar.destroy();
                this.enemyHealth.delete(enemySprite);
                this.updateScore(100); // Score only increases on enemy death
                this.dropCoin(enemy.x, enemy.y); // Drop a coin
            } else {
                this.updateEnemyHealthBar(enemySprite, enemyHealthBar, newHealth);
            }
        });

        // Update enemies
        this.enemies.getChildren().forEach((enemy) => {
            let enemySprite = enemy as Phaser.Physics.Arcade.Sprite;

            // Ensure enemy is still active and has a body
            if (!enemySprite.active || !enemySprite.body) {
                return;
            }

            // Ensure enemy only moves if NOT knocked back
            if (!enemySprite.getData("isKnockedBack")) {
                this.physics.moveToObject(enemySprite, this.player, 100);
            }

            let healthBar = this.enemyHealth.get(enemySprite);
            if (healthBar) {
                this.updateEnemyHealthBar(enemySprite, healthBar, enemySprite.getData("health"));
            }
        });

        // Update player health bar position (stays at the top)
        this.updatePlayerHealthBar();
    }

    spawnEnemy() {
        if (this.enemies.getChildren().length >= this.maxEnemies) return; // ✅ Prevents too many enemies

        let enemy = this.enemies.create(
            Phaser.Math.Between(50, 750),
            Phaser.Math.Between(50, 550),
            "tiles_sprites",
            110
        ) as Phaser.Physics.Arcade.Sprite;

        enemy.setScale(1);
        enemy.setData("health", this.maxEnemyHealth); // ✅ Track enemy health

        // Create health bar graphics
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
        this.playerHealth -= 10;
        console.log(`Player hit! Health: ${this.playerHealth}`);

        // 🔥 Update health bar
        this.updatePlayerHealthBar();

        // Death
        if (this.playerHealth <= 0) {
            this.triggerGameOver(); // ✅ Call game over when health runs out
        }

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

    triggerGameOver() {
        console.log("💀 Game Over! Freezing the game...");
    
        // 🛑 STOP ALL GAME ACTIONS
        this.physics.pause();  // 🚫 Freeze physics, stopping movement
        this.input.keyboard!.enabled = false;  // 🚫 Disable player input
        this.scene.get('GameScene').events.removeAllListeners();  // 🚫 Remove all events
        this.time.removeAllEvents();  // 🚫 Stops timers, prevents enemy spawn
        this.enemies.clear(true, true); // 🚫 Destroy all enemies
    
        // 🎮 Show "Game Over" Text
        this.add.text(400, 250, "GAME OVER", {
            fontSize: "40px",
            color: "#ff0000"
        }).setOrigin(0.5);
    
        // ⏳ Wait and then push the score
        console.log("reached push score");
        this.pushScoreToSolana();
    }    
    
    async pushScoreToSolana() {
        console.log("🚀 Attempting to push score to Solana...");
        
        if (!this.walletPublicKey) {
            console.log("❌ No wallet connected!");
            return;
        }
    
        try {
            console.log("📡 Calling sendScoreToSolana...");
            const signature = await sendScoreToSolana(this.walletPublicKey, this.score);
            
            if (!signature) {
                console.error("❌ Transaction failed or did not return a signature!");
                return;
            }
    
            console.log(`✅ Score pushed to Solana! Transaction: ${signature}`);
    
            // 🎮 Show Final Score & Restart Button
            this.add.text(400, 350, `Final Score: ${this.score}`, {
                fontSize: "24px",
                color: "#ffffff"
            }).setOrigin(0.5);
    
            const restartButton = this.add.text(400, 400, "🔄 Restart", {
                fontSize: "18px",
                color: "#ffffff",
                backgroundColor: "#0000ff",
                padding: { x: 5, y: 2 }
            })
            .setInteractive()
            .setOrigin(0.5)
            .on("pointerdown", () => {
                this.scene.restart(); // 🔄 Restart game
            });
    
        } catch (error) {
            console.error("❌ Failed to push score to Solana:", error);
        }
    }
    
    

    handleEnemyHit(enemy: Phaser.Physics.Arcade.Sprite, attackDirection: string) {
        let enemyHealthBar = this.enemyHealth.get(enemy);
        if (!enemyHealthBar) return;

        if (enemy.getData("isInvincible")) return; // Prevent invincible enemies from taking damage

        let currentHealth = enemy.getData("health") || this.maxEnemyHealth;
        let newHealth = currentHealth - 5;
        enemy.setData("health", newHealth);

        console.log(`Enemy hit! New Health: ${newHealth}`);

        if (newHealth <= 0) {
            this.dropCoin(enemy); // Drop a coin before destroying
            enemy.destroy();
            enemyHealthBar.destroy();
            this.enemyHealth.delete(enemy);
            this.updateScore(100); // Add points on kill
        } else {
            this.updateEnemyHealthBar(enemy, enemyHealthBar, newHealth);

            enemy.setData("isInvincible", true);
            this.time.delayedCall(50, () => { // Invincibility time
                enemy.setData("isInvincible", false);
            });

            // **🔥 Apply Knockback**
            this.applyKnockback(enemy, attackDirection);
        }
    }


    applyKnockback(enemy: Phaser.Physics.Arcade.Sprite, attackDirection: string) {
        if (!enemy.active || !enemy.body) return;

        let velocityX = 0, velocityY = 0;

        switch (attackDirection) {
            case "up":
                velocityY = -this.knockbackStrength;
                break;
            case "down":
                velocityY = this.knockbackStrength;
                break;
            case "left":
                velocityX = -this.knockbackStrength;
                break;
            case "right":
            default:
                velocityX = this.knockbackStrength;
                break;
        }

        enemy.setData("isKnockedBack", true);
        enemy.setVelocity(velocityX, velocityY);

        this.time.delayedCall(this.knockbackDuration, () => {
            if (enemy.active && enemy.body) {
                enemy.setVelocity(0, 0);
                enemy.setData("isKnockedBack", false);
            }
        });
    }

    // Drop a coin 
    dropCoin(enemy: Phaser.Physics.Arcade.Sprite) {
        if (!enemy.active) return;

        let coin = this.coins.create(enemy.x, enemy.y, "coin") as Phaser.Physics.Arcade.Sprite;
        if (!coin) return;

        coin.setScale(1);
        coin.setDepth(5);
        coin.play("coin_spin");

        this.physics.add.overlap(this.player, coin, (player, coinObj) => {
            this.collectCoin(coinObj as Phaser.Physics.Arcade.Sprite);
        });

        // Destroy coin after 10 seconds if not collected**
        this.time.delayedCall(10000, () => {
            if (coin.active) {
                coin.destroy();
            }
        });

        console.log("Coin dropped at:", enemy.x, enemy.y);
    }


    // Collect a coin
    collectCoin(coin: Phaser.Physics.Arcade.Sprite) {
        coin.destroy();
        this.updateScore(50);
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
        slash.body.setSize(50, 50); // Increase hitbox size

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

        // ✅ Play animation dynamically
        slash.play("slash_anim");

        // ✅ **Now we create the overlap here (DYNAMICALLY)**
        this.physics.add.overlap(slash, this.enemies, (slashObj, enemy) => {
            let enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
            this.handleEnemyHit(enemySprite, this.lastDirection);
        });

        // ✅ Destroy slash after animation completes
        slash.on("animationcomplete", () => {
            slash.destroy();
            this.isSlashing = false;
        });

        // Safety check in case animationcomplete doesn’t trigger
        this.time.delayedCall(500, () => {
            if (slash.active) {
                slash.destroy();
            }
            this.isSlashing = false;
        });
    }

    handleBulletHit(bullet: Phaser.GameObjects.GameObject, enemy: Phaser.GameObjects.GameObject) {
        let bulletSprite = bullet as Phaser.Physics.Arcade.Sprite;
        let enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
        let enemyHealthBar = this.enemyHealth.get(enemySprite);

        bulletSprite.destroy(); // Remove the bullet after hitting

        if (!enemyHealthBar) return; // Ensure enemy has a health bar

        // 🔥 Get enemy's current health
        let currentHealth = enemySprite.getData("health") || this.maxEnemyHealth;

        // 🔥 Reduce health
        let newHealth = currentHealth - 5;
        enemySprite.setData("health", newHealth);

        console.log(`Bullet hit! Enemy Health: ${newHealth}`);

        if (newHealth <= 0) {
            // 🔥 Destroy enemy and health bar
            enemySprite.destroy();
            enemyHealthBar.destroy();
            this.enemyHealth.delete(enemySprite);
            this.updateScore(100); // Score only increases on enemy death

            // Respawn after delay
            this.time.delayedCall(1000, () => {
                this.spawnEnemy();
            });

        } else {
            // 🔥 Update enemy health bar
            this.updateEnemyHealthBar(enemySprite, enemyHealthBar, newHealth);
        }
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

    // Modify score
    updateScore(amount: number) {
        this.score += amount; // Increase score
        this.scoreText.setText(`Score: ${this.score}`); // Update UI
    }

    async fetchBalance() {
        if (this.walletPublicKey) {
            const balance = await getWalletBalance(new PublicKey(this.walletPublicKey));
            this.balanceText.setText(`Balance: ${balance.toFixed(2)} SOL`);
        }
    }



}

