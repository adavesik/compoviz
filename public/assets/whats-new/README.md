# What's New Screenshots

This directory contains screenshots/GIFs for the "What's New" modal.

## v1.0.0 Hero

**File**: `compare-v1.webp`
**Size**: 1760x580px (2x for the 880x290 hero, cropped with `object-fit: cover`)
**Content**: Compare mode with the built-in demo (`src/data/compareDemo.js`) loaded, the `*:8080` port conflict selected, and the "Move to free host port 8081" fix visible in the inspector

---

## Required Screenshots (v0.3.0 slides)

Place your screenshots in this directory with the following names:

### Slide 1: Anchor Resolution
**File**: `anchor-resolution.gif`  
**Recommended Size**: 600x400px  
**Content**: Show YAML anchors (&anchor) and aliases (*alias) being used in a compose file, demonstrating how they resolve

**Example**:
- Show a Docker Compose file with anchor definitions
- Highlight how the anchor is reused in multiple services
- Show before/after or hover state showing resolved values

---

### Slide 2: Includes & Extends
**File**: `includes-extends.png`  
**Recommended Size**: 600x400px  
**Content**: Demonstrate the include directive and extends functionality

**Example**:
- Show a project with multiple compose files
- Hilight include/extends directives
- Show how services inherit and merge properties

---

### Slide 3: Profiles
**File**: `profiles.gif`  
**Recommended Size**: 600x400px  
**Content**: Show the Profile Selector in action

**Example**:
- Show profile selector dropdown
- Demonstrate services appearing/disappearing when toggling profiles
- Highlight "dev" vs "prod" vs "test" profiles

---

### Slide 4: Performance
**File**: `performance.png`  
**Recommended Size**: 600x400px  
**Content**: Show large project being parsed quickly

**Example**:
- Screenshot of 50-services project loaded
- Show performance metrics or console output
- Emphasize Web Worker architecture

---

## Tips for Creating Screenshots

1. **Use high-quality captures** - Screenshots should be crisp and clear
2. **Add annotations** - Use arrows, highlights, or text to draw attention to key features
3. **Keep UI visible** - Show enough of the Compoviz UI to provide context
4. **Consider GIFs for interactive features** - Slides 1 and 3 work best as animated GIFs
5. **Use consistent sizing** - All should be 600x400px for uniform appearance

## Tools for Creating GIFs

- **LICEcap** (Windows/Mac) - Simple screen recording to GIF
- **Kap** (Mac) - Beautiful screen recordings
- **Peek** (Linux) - Simple animated GIF recorder
- **ScreenToGif** (Windows) - Feature-rich GIF creator

## Fallback Behavior

If screenshots are missing, the modal will:
- Hide the screenshot container
- Still display the title and description
- Work fully with just text content
