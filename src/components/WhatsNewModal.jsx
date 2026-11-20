import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { ArrowRight, HeartPulse, MousePointerClick, Network, ScanSearch, Sparkles, GitCompare, X } from 'lucide-react';
import { getLatestAnnouncement, shouldShowAnnouncement, markAnnouncementAsSeen } from '../data/announcements';
import './WhatsNewModal.css';

/** Icon keys usable from announcements.js (hero layout). */
const ICONS = {
    'scan-search': ScanSearch,
    sparkles: Sparkles,
    network: Network,
    'mouse-pointer-click': MousePointerClick,
    'heart-pulse': HeartPulse,
    'git-compare': GitCompare,
};

/** Render text with `backtick` segments as inline code. */
function RichText({ text }) {
    if (!text) return null;
    return String(text).split(/`([^`]+)`/).map((part, i) => (
        i % 2 === 1 ? <code key={i} className="wn-code">{part}</code> : <Fragment key={i}>{part}</Fragment>
    ));
}

function FeatureIcon({ name, tone, small = false }) {
    const Icon = ICONS[name] || Sparkles;
    return (
        <span className={`wn-icon wn-tone-${tone || 'accent'} ${small ? 'wn-icon-sm' : ''}`} aria-hidden="true">
            <Icon size={small ? 15 : 18} />
        </span>
    );
}

export default function WhatsNewModal({ onAction }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const [heroFailed, setHeroFailed] = useState(false);
    const primaryRef = useRef(null);
    const announcement = getLatestAnnouncement();
    const version = announcement.version;

    const isHeroMode = announcement.layout === 'hero';
    const isHighlightMode = !isHeroMode && !!announcement.highlights;
    const isSlideMode = !isHeroMode && !isHighlightMode && Array.isArray(announcement.slides);

    useEffect(() => {
        if (shouldShowAnnouncement(version)) {
            requestAnimationFrame(() => setIsOpen(true));
        }
    }, [version]);

    // Move focus into the dialog when it opens; the body class lets CSS hide
    // floating third-party widgets that would sit on top of the modal
    useEffect(() => {
        if (!isOpen) return undefined;
        primaryRef.current?.focus({ preventScroll: true });
        document.body.classList.add('whats-new-open');
        return () => document.body.classList.remove('whats-new-open');
    }, [isOpen]);

    const handleClose = useCallback(() => {
        if (dontShowAgain) {
            markAnnouncementAsSeen(version);
        }
        setIsOpen(false);
    }, [dontShowAgain, version]);

    /** Run an announcement action and close the modal. */
    const runAction = useCallback((action) => {
        if (action && action.type !== 'dismiss' && onAction) onAction(action);
        markAnnouncementAsSeen(version);
        setIsOpen(false);
    }, [onAction, version]);

    const handleCTA = () => {
        if (isHeroMode) runAction(announcement.primaryAction);
        else if (isHighlightMode) runAction(announcement.action);
        else runAction(announcement.slides[currentSlide].action);
    };

    const handleNext = useCallback(() => {
        if (isSlideMode && currentSlide < announcement.slides.length - 1) {
            setCurrentSlide(currentSlide + 1);
        }
    }, [currentSlide, announcement, isSlideMode]);

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

    const dontShowCheckbox = (
        <label className="whats-new-checkbox">
            <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} />
            <span>Don&apos;t show this again</span>
        </label>
    );

    if (isHeroMode) {
        const { hero, features = [], also, primaryAction, secondaryAction } = announcement;
        return (
            <div className="whats-new-overlay modal-backdrop" onClick={handleClose}>
                <div
                    className="whats-new-modal wn-hero-modal modal-content"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="wn-title"
                    aria-describedby="wn-lede"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className={`wn-hero ${heroFailed || !hero?.src ? 'wn-hero-empty' : ''}`}>
                        {hero?.src && !heroFailed && (
                            <img src={hero.src} alt={hero.alt || ''} className="wn-hero-img" onError={() => setHeroFailed(true)} />
                        )}
                        <div className="wn-hero-top">
                            <span className="wn-pill">
                                <span className="wn-pill-dot" aria-hidden="true" />
                                v{version}{announcement.badge ? ` · ${announcement.badge}` : ''}
                            </span>
                            <button type="button" className="wn-close" onClick={handleClose} aria-label="Close">
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="wn-body">
                        {announcement.eyebrow && (
                            <p className="wn-eyebrow">
                                <GitCompare size={14} aria-hidden="true" /> {announcement.eyebrow}
                            </p>
                        )}
                        <h2 id="wn-title" className="wn-title font-display">
                            {announcement.title || 'Compoviz'}{' '}
                            {announcement.titleAccent && <em>{announcement.titleAccent}</em>}
                        </h2>
                        {announcement.lede && <p id="wn-lede" className="wn-lede">{announcement.lede}</p>}

                        <ul className="wn-grid">
                            {features.map((f, i) => (
                                <li key={f.title} className="wn-card" style={{ animationDelay: `${0.06 * i}s` }}>
                                    <FeatureIcon name={f.icon} tone={f.tone} />
                                    <div>
                                        <h3 className="wn-card-title">{f.title}</h3>
                                        <p className="wn-card-desc"><RichText text={f.description} /></p>
                                    </div>
                                </li>
                            ))}
                        </ul>

                        {also && (
                            <div className="wn-also">
                                <FeatureIcon name={also.icon} tone={also.tone} small />
                                <p>
                                    {also.label && <span className="wn-also-label">{also.label}</span>}{' '}
                                    <strong>{also.title}</strong> <RichText text={also.description} />
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="wn-footer">
                        {dontShowCheckbox}
                        <div className="wn-actions">
                            {secondaryAction?.type === 'link' && secondaryAction.href && (
                                <a className="wn-btn-ghost" href={secondaryAction.href} target="_blank" rel="noopener noreferrer">
                                    {secondaryAction.label}
                                </a>
                            )}
                            <button ref={primaryRef} type="button" className="wn-btn-cta" onClick={handleCTA}>
                                {primaryAction?.label || 'Got it'} <ArrowRight size={16} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="whats-new-overlay modal-backdrop" onClick={handleClose}>
            <div
                className="whats-new-modal modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby="wn-title"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="whats-new-header">
                    <h2 id="wn-title" className="font-display">
                        Compoviz <span className="whats-new-version">v{version}</span>
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
                            <div className="whats-new-navigation">
                                <button ref={primaryRef} className="whats-new-cta" onClick={handleCTA}>
                                    {announcement.action?.label || 'Got it'}
                                </button>
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
                                <button ref={primaryRef} className="whats-new-cta" onClick={handleCTA}>{announcement.slides[currentSlide].action.label}</button>
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

                    <div className="whats-new-footer">{dontShowCheckbox}</div>
                </div>
            </div>
        </div>
    );
}
