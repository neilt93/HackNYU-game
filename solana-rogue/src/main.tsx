import Phaser from "phaser";
import GameScene from "./game/GameScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 640, // Increase width
  height: 480, // Increase height
  scale: {
    mode: Phaser.Scale.FIT, // Fit to screen
    autoCenter: Phaser.Scale.CENTER_BOTH // Center the game
  },
  scene: [GameScene],
  physics: {
    default: "arcade",
    arcade: { debug: false }
  }
};

const game = new Phaser.Game(config);
