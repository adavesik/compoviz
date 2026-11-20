import { useCallback, useEffect, useRef, useState } from 'react';

const DRAG_THRESHOLD = 4;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Pan & zoom for a fixed-size content element inside a viewport.
 *
 * The content is transformed with `translate(x, y) scale(s)` and
 * `transform-origin: 0 0`, so a content point p maps to screen point
 * `p * s + (x, y)`. All anchoring math below relies on that.
 *
 * @param {object} [options]
 * @param {number} [options.minScale=0.1]
 * @param {number} [options.maxScale=4]
 * @param {() => {left:number,right:number,top:number,bottom:number}} [options.getInsets]
 *        Areas of the viewport covered by overlays (side panels); fit/focus avoid them.
 */
export function usePanZoom({ minScale = 0.1, maxScale = 4, getInsets } = {}) {
    const viewportRef = useRef(null);
    const [view, setViewState] = useState({ x: 0, y: 0, scale: 1, animate: false });
    const viewRef = useRef(view);
    const contentSizeRef = useRef({ width: 0, height: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const pointersRef = useRef(new Map());
    const gestureRef = useRef(null);
    const movedRef = useRef(false);
    const getInsetsRef = useRef(getInsets);
    useEffect(() => {
        getInsetsRef.current = getInsets;
    });

    const setView = useCallback((next, animate = false) => {
        const value = { ...next, scale: clamp(next.scale, minScale, maxScale), animate };
        viewRef.current = value;
        setViewState(value);
    }, [minScale, maxScale]);

    const insets = useCallback(
        () => ({ left: 0, right: 0, top: 0, bottom: 0, ...(getInsetsRef.current?.() || {}) }),
        []
    );

    /** Zoom so that the given screen point (relative to the viewport) stays fixed. */
    const zoomAt = useCallback((factor, point, animate = false) => {
        const { x, y, scale } = viewRef.current;
        const nextScale = clamp(scale * factor, minScale, maxScale);
        if (nextScale === scale) return;
        const ratio = nextScale / scale;
        setView({
            x: point.x - (point.x - x) * ratio,
            y: point.y - (point.y - y) * ratio,
            scale: nextScale,
        }, animate);
    }, [minScale, maxScale, setView]);

    /** Zoom around the center of the visible (non-covered) area. */
    const zoomBy = useCallback((factor) => {
        const el = viewportRef.current;
        if (!el) return;
        const i = insets();
        zoomAt(factor, {
            x: i.left + (el.clientWidth - i.left - i.right) / 2,
            y: i.top + (el.clientHeight - i.top - i.bottom) / 2,
        }, true);
    }, [zoomAt, insets]);

    /** Fit a content-space rectangle into the visible area. */
    const focusRect = useCallback((rect, { padding = 48, maxFitScale = 1.25, animate = true } = {}) => {
        const el = viewportRef.current;
        if (!el || !rect || !rect.width || !rect.height) return;
        const i = insets();
        const availW = Math.max(80, el.clientWidth - i.left - i.right - padding * 2);
        const availH = Math.max(80, el.clientHeight - i.top - i.bottom - padding * 2);
        const scale = clamp(Math.min(availW / rect.width, availH / rect.height, maxFitScale), minScale, maxScale);
        const centerX = i.left + (el.clientWidth - i.left - i.right) / 2;
        const centerY = i.top + (el.clientHeight - i.top - i.bottom) / 2;
        setView({
            x: centerX - (rect.x + rect.width / 2) * scale,
            y: centerY - (rect.y + rect.height / 2) * scale,
            scale,
        }, animate);
    }, [minScale, maxScale, setView, insets]);

    const fit = useCallback((animate = true) => {
        const { width, height } = contentSizeRef.current;
        if (!width || !height) return;
        focusRect({ x: 0, y: 0, width, height }, { padding: 32, maxFitScale: 1.25, animate });
    }, [focusRect]);

    const setContentSize = useCallback((size) => {
        contentSizeRef.current = size;
    }, []);

    /** Convert a DOMRect (screen) of an element inside the content into content coordinates. */
    const toContentRect = useCallback((domRect) => {
        const el = viewportRef.current;
        if (!el || !domRect) return null;
        const vp = el.getBoundingClientRect();
        const { x, y, scale } = viewRef.current;
        return {
            x: (domRect.left - vp.left - x) / scale,
            y: (domRect.top - vp.top - y) / scale,
            width: domRect.width / scale,
            height: domRect.height / scale,
        };
    }, []);

    /** True if the last pointer interaction was a drag (use to suppress click). */
    const wasDrag = useCallback(() => movedRef.current, []);

    // ── Wheel (native listener so preventDefault works) ──
    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return undefined;
        const onWheel = (e) => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            // Trackpad pinch arrives as ctrl+wheel with small deltas
            const intensity = e.ctrlKey ? 0.01 : 0.0015;
            const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
            if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.shiftKey) {
                // Horizontal trackpad scroll pans
                const { x, y, scale } = viewRef.current;
                setView({ x: x - e.deltaX, y, scale });
                return;
            }
            zoomAt(Math.exp(-delta * intensity), point);
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [zoomAt, setView]);

    // ── Pointer pan + pinch ──
    const onPointerDown = useCallback((e) => {
        if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
        if (!viewportRef.current) return;
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        movedRef.current = false;
        const { x, y, scale } = viewRef.current;
        if (pointersRef.current.size === 1) {
            gestureRef.current = { type: 'pan', startX: e.clientX, startY: e.clientY, x, y };
        } else if (pointersRef.current.size === 2) {
            const [a, b] = [...pointersRef.current.values()];
            gestureRef.current = {
                type: 'pinch',
                distance: Math.hypot(a.x - b.x, a.y - b.y),
                scale,
            };
        }
    }, []);

    const onPointerMove = useCallback((e) => {
        if (!pointersRef.current.has(e.pointerId)) return;
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g = gestureRef.current;
        if (!g) return;
        if (g.type === 'pan') {
            const dx = e.clientX - g.startX;
            const dy = e.clientY - g.startY;
            if (!movedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
            if (!movedRef.current) {
                movedRef.current = true;
                setIsPanning(true);
                // Capture only once dragging starts so plain clicks still reach nodes
                viewportRef.current?.setPointerCapture?.(e.pointerId);
            }
            setView({ x: g.x + dx, y: g.y + dy, scale: viewRef.current.scale });
        } else if (g.type === 'pinch' && pointersRef.current.size === 2) {
            movedRef.current = true;
            const [a, b] = [...pointersRef.current.values()];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            const rect = viewportRef.current.getBoundingClientRect();
            const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
            const targetScale = g.scale * (distance / (g.distance || 1));
            zoomAt(targetScale / viewRef.current.scale, mid);
        }
    }, [setView, zoomAt]);

    const onPointerUp = useCallback((e) => {
        pointersRef.current.delete(e.pointerId);
        if (viewportRef.current?.hasPointerCapture?.(e.pointerId)) {
            viewportRef.current.releasePointerCapture(e.pointerId);
        }
        if (pointersRef.current.size === 0) {
            gestureRef.current = null;
            setIsPanning(false);
        } else if (pointersRef.current.size === 1) {
            // Continue panning with remaining finger
            const [p] = [...pointersRef.current.values()];
            const { x, y } = viewRef.current;
            gestureRef.current = { type: 'pan', startX: p.x, startY: p.y, x, y };
        }
    }, []);

    const contentStyle = {
        transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        transformOrigin: '0 0',
        transition: view.animate ? 'transform 0.25s ease-out' : 'none',
        willChange: 'transform',
    };

    return {
        viewportRef,
        view,
        contentStyle,
        isPanning,
        zoomBy,
        zoomAt,
        fit,
        focusRect,
        toContentRect,
        setContentSize,
        wasDrag,
        viewportHandlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
        },
    };
}
