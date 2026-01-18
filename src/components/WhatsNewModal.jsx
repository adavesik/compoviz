import { useState, useEffect, useCallback } from 'react';
import { getLatestAnnouncement, shouldShowAnnouncement, markAnnouncementAsSeen } from '../data/announcements';
import './WhatsNewModal.css';

const APP_VERSION = '0.3.0'; // TODO: Get from package.json

export default function WhatsNewModal({ onAction }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const announcement = getLatestAnnouncement();

    useEffect(() => {
        // Check if we should show the modal
        // Use requestAnimationFrame to avoid cascading renders
        if (shouldShowAnnouncement(APP_VERSION)) {
            requestAnimationFrame(() => {
                setIsOpen(true);
            });
        }
    }, []);

    const handleClose = useCallback(() => {
        if (dontShowAgain) {
            markAnnouncementAsSeen(APP_VERSION);
        }
        setIsOpen(false);
    }, [dontShowAgain]);

    const handleNext = useCallback(() => {
        if (currentSlide < announcement.slides.length - 1) {
            setCurrentSlide(currentSlide + 1);
        }
    }, [currentSlide, announcement.slides.length]);

    const handlePrevious = useCallback(() => {
        if (currentSlide > 0) {
            setCurrentSlide(currentSlide - 1);
        }
    }, [currentSlide]);

    const handleDotClick = (index) => {
        setCurrentSlide(index);
    };

    const handleTryIt = () => {
        const slide = announcement.slides[currentSlide];

        // Execute the action
        if (onAction) {
            onAction(slide.action);
        }

        // Close modal after action
        markAnnouncementAsSeen(APP_VERSION);
        setIsOpen(false);
    };

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;

            if (e.key === 'Escape') {
                handleClose();
            } else if (e.key === 'ArrowLeft') {
                handlePrevious();
            } else if (e.key === 'ArrowRight') {
                handleNext();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentSlide, handleClose, handlePrevious, handleNext]);

    if (!isOpen) return null;

    const currentSlideData = announcement.slides[currentSlide];

    return (
        <div className="whats-new-overlay" onClick={handleClose}>
            <div className="whats-new-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="whats-new-header">
                    <h2>✨ What&apos;s New in Compoviz v{announcement.version}</h2>
                    <button
                        className="whats-new-close"
                        onClick={handleClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="whats-new-content">
                    {/* Screenshot */}
                    <div className="whats-new-screenshot">
                        <img
                            key={currentSlideData.id} // Force re-render when slide changes
                            src={currentSlideData.screenshot}
                            alt={currentSlideData.title}
                            onError={(e) => {
                                // Fallback for missing screenshots
                                e.target.style.display = 'none';
                            }}
                        />
                    </div>

                    {/* Feature Info */}
                    <div className="whats-new-info">
                        <h3>
                            <span className="whats-new-emoji">{currentSlideData.emoji}</span>
                            {currentSlideData.title}
                        </h3>
                        <p>{currentSlideData.description}</p>
                    </div>

                    {/* Navigation */}
                    <div className="whats-new-navigation">
                        <button
                            className="whats-new-nav-btn"
                            onClick={handlePrevious}
                            disabled={currentSlide === 0}
                        >
                            ← Previous
                        </button>

                        <button
                            className="whats-new-cta"
                            onClick={handleTryIt}
                        >
                            {currentSlideData.action.label}
                        </button>

                        <button
                            className="whats-new-nav-btn"
                            onClick={handleNext}
                            disabled={currentSlide === announcement.slides.length - 1}
                        >
                            Next →
                        </button>
                    </div>

                    {/* Dots */}
                    <div className="whats-new-dots">
                        {announcement.slides.map((_, index) => (
                            <button
                                key={index}
                                className={`whats-new-dot ${index === currentSlide ? 'active' : ''}`}
                                onClick={() => handleDotClick(index)}
                                aria-label={`Go to slide ${index + 1}`}
                            />
                        ))}
                    </div>

                    {/* Don't show again */}
                    <div className="whats-new-footer">
                        <label className="whats-new-checkbox">
                            <input
                                type="checkbox"
                                checked={dontShowAgain}
                                onChange={(e) => setDontShowAgain(e.target.checked)}
                            />
                            <span>Don&apos;t show this again</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
}
