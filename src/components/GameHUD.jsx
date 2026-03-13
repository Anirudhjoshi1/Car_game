import React from 'react';

export default function GameHUD({ speed, activeKeys }) {
    const displaySpeed = Math.round(Math.abs(speed));

    return (
        <div className="game-hud">
            {/* Top status bar */}
            <div className="hud-top-bar">
                <div className="hud-dot" />
                <span className="hud-label">Exploring Portfolio World</span>
            </div>

            {/* Minimap Border Overlay */}
            <div className="hud-minimap">
                <div className="hud-minimap-car" />
            </div>

            {/* Speed display */}
            <div className="hud-speed">
                <div className="hud-speed-value">{displaySpeed}</div>
                <div className="hud-speed-unit">km/h</div>
            </div>

            {/* Controls hint */}
            <div className="hud-controls">
                <div className="hud-controls-row" style={{ alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem', fontWeight: '600', letterSpacing: '2px', marginRight: '8px' }}>NITROS =</span>
                    <div className={`hud-key ${activeKeys.shift ? 'active' : ''}`} style={{ width: '60px' }}>Shift</div>
                </div>
                <div className="hud-controls-row">
                    <div className={`hud-key ${activeKeys.w ? 'active' : ''}`}>W</div>
                </div>
                <div className="hud-controls-row">
                    <div className={`hud-key ${activeKeys.a ? 'active' : ''}`}>A</div>
                    <div className={`hud-key ${activeKeys.s ? 'active' : ''}`}>S</div>
                    <div className={`hud-key ${activeKeys.d ? 'active' : ''}`}>D</div>
                </div>
                <div className="hud-controls-row">
                    <div className={`hud-key ${activeKeys.space ? 'active' : ''}`} style={{ width: '120px', letterSpacing: '2px', fontSize: '0.8rem' }}>SPACE (DRIFT)</div>
                </div>
            </div>
        </div>
    );
}
