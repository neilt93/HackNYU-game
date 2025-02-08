import Phaser from "phaser";
import { useEffect } from "react";
import GameScene from "./GameScene";

const GameComponent: React.FC = () => {
  useEffect(() => {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      scene: GameScene,
      physics: { default: "arcade" },
      parent: "game-container",
    };

    const game = new Phaser.Game(config);
    return () => game.destroy(true);
  }, []);

  return <div id="game-container"></div>;
};

export default GameComponent;
