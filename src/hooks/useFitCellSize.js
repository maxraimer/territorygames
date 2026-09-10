import { useEffect, useRef, useState } from "react";

// Below this viewport width the board keeps its plain row-count-threshold
// size (getCellSize/getHexSize) instead of being fitted — must match the
// `lg` breakpoint App.jsx uses to switch the playing screen between a
// stacked (sidebar above board) and side-by-side layout. Below it the
// sidebar sits above the board, so the board's on-screen `top` (and thus
// the "available height" this hook fits against) is pushed far down by
// the sidebar's own height rather than reflecting real screen space —
// fitting against it there shrinks the board more as the sidebar grows,
// not less. A dedicated mobile board layout is a separate, later effort,
// so phones intentionally don't get this treatment either.
const MOBILE_BREAKPOINT = 1024;
// Rough starting guess for the chrome below/around the board (the board
// wrapper's own padding+border, the page's own bottom padding, ...) — not
// exact on purpose, since hardcoding those precisely is brittle if the
// surrounding layout ever changes. The overflow-correction pass below
// makes up the difference either way.
const BASE_MARGIN = 40;
const MAX_CORRECTION_PASSES = 8;

/**
 * Picks a per-cell pixel size so the whole board fits the viewport's
 * remaining space below (and beside) its on-screen position, growing
 * `staticSize` up to `maxSize` when there's extra room. `heightPerUnit`/
 * `widthPerUnit` are the board's total pixel dimensions per 1px of cell
 * size — `rows`/`cols` for a square grid, a shape-dependent factor for
 * hex's offset rows/cols — since both board renderers' width/height
 * formulas are linear in cell size, this avoids needing per-shape layout
 * math here.
 *
 * This only ever grows the board, never shrinks it below `staticSize`: a
 * cramped viewport (a short browser window, a laptop with little vertical
 * room) is expected to let the board scroll into view rather than shrink
 * cells/hexes down to an illegible size — the point of "fitting" is to use
 * generous screens well, not to guarantee the whole board is always
 * visible without scrolling.
 *
 * The initial estimate (from BASE_MARGIN) can't precisely predict every bit
 * of real padding/border around the board, so after each render this also
 * checks whether the *page* actually still scrolls vertically and, if so,
 * shrinks by one more pixel of cell size (down to `staticSize`, never
 * below) and re-checks — a few of these correction passes reliably
 * converge on a size with no scrollbar when one is achievable without
 * shrinking past the static size, without needing to hardcode exact
 * surrounding-layout dimensions.
 */
export default function useFitCellSize(containerRef, { heightPerUnit, widthPerUnit, staticSize, maxSize }) {
  const [size, setSize] = useState(staticSize);
  const correctionPasses = useRef(0);

  useEffect(() => {
    function estimate() {
      if (window.innerWidth < MOBILE_BREAKPOINT || !containerRef.current) return staticSize;
      const top = containerRef.current.getBoundingClientRect().top;
      const availableHeight = window.innerHeight - top - BASE_MARGIN;
      const availableWidth = containerRef.current.clientWidth - BASE_MARGIN;
      const fitted = Math.min(availableHeight / heightPerUnit, availableWidth / widthPerUnit);
      return Math.max(staticSize, Math.min(maxSize, Math.floor(fitted)));
    }
    function recompute() {
      correctionPasses.current = 0;
      setSize(estimate());
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [containerRef, heightPerUnit, widthPerUnit, staticSize, maxSize]);

  useEffect(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) return;
    if (correctionPasses.current >= MAX_CORRECTION_PASSES) return;
    const stillOverflows = document.documentElement.scrollHeight > document.documentElement.clientHeight;
    if (!stillOverflows) return;
    correctionPasses.current += 1;
    setSize((prev) => Math.max(staticSize, prev - 1));
  }, [size, staticSize]);

  return size;
}
