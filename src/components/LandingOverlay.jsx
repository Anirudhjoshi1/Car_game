import React from 'react';

export default function LandingOverlay({ onStart }) {
    return (
        <div className="landing-overlay">
            <div className="landing-content">
                <p className="landing-subtitle">Welcome to my world</p>
                <h1 className="landing-title">Creative Developer</h1>
                <p className="landing-tagline">An immersive portfolio experience</p>
                <button className="start-btn" onClick={onStart}>
                    Start Experience
                    <span className="btn-arrow">→</span>
                </button>
            </div>
            <div className="landing-hint">Scroll to explore</div>
        </div>
    );
}
