---
name: ae
description: Route an explicit After Effects request through the installed Uniprae MCP server. Use when the user invokes $ae or asks to control After Effects through Uniprae.
---

Use Uniprae's `ae_*` tools and the After Effects host only. Check connection and inspect the active composition before mutation. Complete the user's request from `$ARGUMENTS`, then verify the resulting composition or preview.

For motion-design requests, inspect the composition dimensions, frame rate, existing layers, footage and available fonts before choosing a design. Preserve the user's reference, brand, copy and existing artwork. For an open brief, choose a coherent visual direction and briefly state it; do not turn a small edit into a redesign.

Build a deliberate hierarchy: one focal message, legible type at the output size, consistent alignment and spacing, a restrained palette and safe margins. Check text bounds after changing fonts or copy. Use editable text and shape layers when appropriate, descriptive layer names and precomps for reusable groups. Do not flatten everything or replace existing assets without need.

## Geometry and transform integrity

Before animation, place each anchor point where the intended motion requires it. Center it on the visual bounds for centered scale or rotation; use a hinge, baseline, edge or custom pivot when the design calls for one. For text and shape layers, derive bounds with `sourceRectAtTime()` when script access permits, accounting for `left` and `top`, and compensate position so changing the anchor does not make the layer jump. When parenting, preserve world position unless deliberate local alignment is requested; then set the parent and explicitly establish the child's local transforms. Confirm whether a property is 1D, 2D or 3D before assigning values, expressions or temporal-ease arrays.

## Motion system

Animate with a clear entrance, readable hold and intentional exit. Choose easing from the desired character rather than a fixed preset. Modern UI motion often benefits from a fast launch and longer deceleration; expressive work may use restrained anticipation, overshoot, squash-and-stretch or an inertial settle. Preserve apparent volume during squash-and-stretch and keep secondary motion subordinate to the message. Avoid applying springs or bounce to every property.

Use purposeful stagger to guide attention instead of revealing every element at once. A short 2–6-frame offset is a useful starting range, adjusted for frame rate, density, music and reading time. For kinetic type, reveal words or characters only when it improves comprehension; position, scale, opacity and blur should resolve into a stable, readable hold. Set timing relative to the composition frame rate and inspect the resulting velocity—not only the keyframe values. Avoid overshoot, motion blur, glow, cameras or 3D unless they support the requested style.

## Visual direction and finish

Use exact supplied brand colors, fonts, radii and component structure. If the user asks to derive a system from a live brand, research or asset retrieval requires the appropriate available tools and permission; never claim a brand match from memory. Without a brand system, select a coherent contemporary palette rather than raw default primaries. Dark graphite canvases, luminous restrained accents and high-contrast neutral typography are options, not defaults.

Build depth only when it serves the concept. Glass panels, rim highlights, layered shadows, bloom, grain, particles, trail lines, progress rings and perspective tilts are stylistic tools—not mandatory decoration. Keep effects subtle, consistent and performant. Protect faces, speakers, product UI and other focal subjects, especially in vertical layouts. Respect action-safe and title-safe areas and evaluate contrast against the actual underlying footage.

For custom illustrations, mascots or complex icons, use an available image-generation or vector workflow only when the user requests or the brief clearly needs original artwork. Inspect the result, preserve editability where practical, import it cleanly and integrate it into the composition hierarchy. Do not invoke an unavailable generator or substitute generated branding for official assets.

Preview representative entrance, hold and exit frames, and motion playback when available. Check clipping, contrast, alignment, text readability, layer ordering and timing; fix observed defects. If preview tools are unavailable, report that limitation and inspect layer properties without claiming visual verification. After an uncertain timeout, inspect before retrying an edit. Deliver the composition name and what was verified; do not render, publish or overwrite unrelated work unless requested.
