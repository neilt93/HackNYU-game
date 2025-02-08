import { useState } from 'react'
import './App.css'
import GameComponent from './game/GameComponent'
import { Game } from 'phaser'

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-800 text-white">
      <GameComponent />
    </div>
  );
};

export default App
