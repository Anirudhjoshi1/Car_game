import React, { useEffect, useRef, useState, useCallback } from 'react';
import LandingOverlay from './components/LandingOverlay';
import GameHUD from './components/GameHUD';
import { SceneManager } from './three/SceneManager';

export default function App() {
    const canvasRef = useRef(null);
    const sceneManagerRef = useRef(null);
    const [gameState, setGameState] = useState('landing'); // 'landing' | 'transitioning' | 'playing'
    const [speed, setSpeed] = useState(0);
    const [activeKeys, setActiveKeys] = useState({});

    // Initialize Three.js scene
    useEffect(() => {
        if (!canvasRef.current || sceneManagerRef.current) return;

        const manager = new SceneManager(canvasRef.current);
        sceneManagerRef.current = manager;

        // Speed update callback
        manager.onSpeedUpdate = (s) => setSpeed(s);
        manager.onKeysUpdate = (keys) => setActiveKeys({ ...keys });

        manager.init();

        return () => {
            manager.dispose();
            sceneManagerRef.current = null;
        };
    }, []);

    const handleStart = useCallback(() => {
        if (!sceneManagerRef.current) return;
        setGameState('transitioning');
        sceneManagerRef.current.startGame(() => {
            setGameState('playing');
        });
    }, []);

    return (
        <>
            <div id="canvas-container" ref={canvasRef} />

            {gameState === 'landing' && (
                <LandingOverlay onStart={handleStart} />
            )}

            {gameState === 'transitioning' && (
                <div className="landing-overlay hidden" />
            )}

            {gameState === 'playing' && (
                <GameHUD speed={speed} activeKeys={activeKeys} />
            )}
        </>
    );
}
