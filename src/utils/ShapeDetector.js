/**
 * ShapeDetector - Recognizes drawn shapes
 * Strategy:
 *   1. Smooth the stroke to remove mouse noise
 *   2. Use Douglas-Peucker to find true corner points
 *   3. Corner count determines shape:
 *      - line:     non-closed, nearly horizontal
 *      - circle:   closed, 0-2 corners
 *      - triangle: closed, 3-6 corners
 */

export class ShapeDetector {

  static analyzeStroke(points) {
    if (points.length < 6) {
      return { type: null, center: null };
    }

    // Step 1: smooth away mouse jitter
    const smoothed = this.smooth(points, 5);

    // Step 2: compute closure based on bounding-box diagonal
    const closure = this.calcClosure(smoothed);

    // Step 3: check line first (non-closed + nearly horizontal)
    const bbox = this.boundingBox(smoothed);
    const aspectRatio = bbox.height / (bbox.width || 1);
    if (aspectRatio < 0.3 && closure < 0.5) {
      return { type: 'line', center: this.centroid(smoothed) };
    }

    if (closure < 0.35) {
      return { type: null, center: null };   // open stroke, not a shape
    }

    // Step 4: find corners with Douglas-Peucker
    // Use ~3% of bounding diagonal as epsilon — tolerant of hand-drawing
    const epsilon = Math.sqrt(bbox.width ** 2 + bbox.height ** 2) * 0.08;
    const simplified = this.douglasPeucker(smoothed, epsilon);
    const corners = simplified.length - 1; // subtract duplicate endpoint if closed

    console.log(`Closure: ${closure.toFixed(2)}  DP corners: ${corners}  aspect: ${aspectRatio.toFixed(2)}`);

    // Step 5: classify by corner count
    // DP corners ≥ 5 = circle (smooth curve, keeps more control points)
    // DP corners ≤ 4 = triangle (sharp angles, simplified to corners)
    if (corners >= 5) {
      return { type: 'circle', center: this.centroid(smoothed) };
    }

    return { type: 'triangle', center: this.centroid(smoothed) };
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  /** Moving-average smoothing */
  static smooth(pts, windowHalf = 4) {
    const w = windowHalf;
    return pts.map((_, i) => {
      let sx = 0, sy = 0, count = 0;
      for (let j = Math.max(0, i - w); j <= Math.min(pts.length - 1, i + w); j++) {
        sx += pts[j].x; sy += pts[j].y; count++;
      }
      return { x: sx / count, y: sy / count };
    });
  }

  /** Douglas-Peucker polyline simplification */
  static douglasPeucker(pts, epsilon) {
    if (pts.length < 3) return pts;

    // Find the point with max distance from the line (start→end)
    let maxDist = 0, maxIdx = 0;
    const start = pts[0], end = pts[pts.length - 1];

    for (let i = 1; i < pts.length - 1; i++) {
      const d = this.pointLineDistance(pts[i], start, end);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }

    if (maxDist > epsilon) {
      const left  = this.douglasPeucker(pts.slice(0, maxIdx + 1), epsilon);
      const right = this.douglasPeucker(pts.slice(maxIdx), epsilon);
      return [...left.slice(0, -1), ...right];
    }

    return [pts[0], pts[pts.length - 1]];
  }

  /** Perpendicular distance from point p to line (a→b) */
  static pointLineDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
  }

  /** Closure: 1 = perfectly closed, 0 = completely open */
  static calcClosure(pts) {
    const bb = this.boundingBox(pts);
    const diag = Math.sqrt(bb.width ** 2 + bb.height ** 2) || 1;
    const dist = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);
    return Math.max(0, Math.min(1, 1 - dist / diag));
  }

  static boundingBox(pts) {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: Math.min(...ys), maxY: Math.max(...ys),
      width:  Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }

  static centroid(pts) {
    return {
      x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    };
  }
}
