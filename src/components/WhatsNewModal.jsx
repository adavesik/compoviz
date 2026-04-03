import { useState, useEffect, useCallback } from 'react';
import { getLatestAnnouncement, shouldShowAnnouncement, markAnnouncementAsSeen } from '../data/announcements';
import './WhatsNewModal.css';

const APP_VERSION = '0.4.0';

export default function WhatsNewModal({ onAction }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const announcement = getLatestAnnouncement();

    const isHighlightMode = !!announcement.highlights;

    useEffect(() => {
        if (shouldShowAnnouncement(APP_VERSION)) {
            requestAnimationFrame(() => setIsOpen(true));
        }
    }, []);

    const handleClose = useCallback(() => {
        if (dontShowAgain) {
            markAnnouncementAsSeen(APP_VERSION);
        }
        setIsOpen(false);
    }, [dontShowAgain]);

    const handleCTA = () => {
        if (isHighlightMode) {
            // Single-screen: just close
            if (announcement.action?.type === 'dismiss') {
                markAnnouncementAsSeen(APP_VERSION);
                setIsOpen(false);
                return;
            }
            if (onAction) onAction(announcement.action);
        } else {
            // Slideshow: execute slide action
            const slide = announcement.slides[currentSlide];
            if (onAction) onAction(slide.action);
        }
        markAnnouncementAsSeen(APP_VERSION);
        setIsOpen(false);
    };

    const handleNext = useCallback(() => {
        if (!isHighlightMode && currentSlide < announcement.slides.length - 1) {
            setCurrentSlide(currentSlide + 1);
        }
    }, [currentSlide, announcement, isHighlightMode]);

    const handlePrevious = useCallback(() => {
        if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
    }, [currentSlide]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            if (e.key === 'Escape') handleClose();
            else if (e.key === 'ArrowLeft') handlePrevious();
            else if (e.key === 'ArrowRight') handleNext();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleClose, handlePrevious, handleNext]);

    if (!isOpen) return null;

    return (
        <div className="whats-new-overlay modal-backdrop" onClick={handleClose}>
            <div className="whats-new-modal modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="whats-new-header">
                    <h2 className="font-display">
                        Compoviz <span className="whats-new-version">v{announcement.version}</span>
                    </h2>
                    <button className="whats-new-close" onClick={handleClose} aria-label="Close">×</button>
                </div>

                <div className="whats-new-content">
                    {isHighlightMode ? (
                        /* ── Single-screen highlight mode ── */
                        <>
                            <p className="whats-new-subtitle">Here&apos;s what changed</p>
                            <div className="whats-new-highlights">
                                {announcement.highlights.map((h, i) => (
                                    <div key={i} className="whats-new-highlight-item" style={{ animationDelay: `${0.08 * i}s` }}>
                                        <span className="whats-new-highlight-emoji">{h.emoji}</span>
                                        <div>
                                            <p className="whats-new-highlight-title">{h.title}</p>
                                            <p className="whats-new-highlight-desc">{h.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        /* ── Slideshow mode (legacy) ── */
                        <>
                            <div className="whats-new-screenshot">
                                <img
                                    key={announcement.slides[currentSlide].id}
                                    src={announcement.slides[currentSlide].screenshot}
                                    alt={announcement.slides[currentSlide].title}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            </div>
                            <div className="whats-new-info">
                                <h3>
                                    <span className="whats-new-emoji">{announcement.slides[currentSlide].emoji}</span>
                                    {announcement.slides[currentSlide].title}
                                </h3>
                                <p>{announcement.slides[currentSlide].description}</p>
                            </div>
                            <div className="whats-new-navigation">
                                <button className="whats-new-nav-btn" onClick={handlePrevious} disabled={currentSlide === 0}>← Previous</button>
                                <button className="whats-new-cta" onClick={handleCTA}>{announcement.slides[currentSlide].action.label}</button>
                                <button className="whats-new-nav-btn" onClick={handleNext} disabled={currentSlide === announcement.slides.length - 1}>Next →</button>
                            </div>
                            <div className="whats-new-dots">
                                {announcement.slides.map((_, index) => (
                                    <button key={index} className={`whats-new-dot ${index === currentSlide ? 'active' : ''}`}
                                        onClick={() => setCurrentSlide(index)} aria-label={`Go to slide ${index + 1}`} />
                                ))}
                            </div>
                        </>
                    )}

                    {/* CTA + footer */}
                    {isHighlightMode && (
                        <div className="whats-new-navigation">
                            <button className="whats-new-cta" onClick={handleCTA}>
                                {announcement.action?.label || 'Got it'}
                            </button>
                        </div>
                    )}

                    <div className="whats-new-footer">
                        <label className="whats-new-checkbox">
                            <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} />
                            <span>Don&apos;t show this again</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
}
