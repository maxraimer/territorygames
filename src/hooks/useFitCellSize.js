import { useEffect, useState } from "react";

// Below this viewport width the board keeps its plain row-count-threshold
// size (getCellSize/getHexSize) — a dedicated mobile board layout is a
// separate, later effort, so phones intentionally don't get this treatment.
const MOBILE_BREAKPOINT = 768;
const VIEWPORT_MARGIN = 16;
const MIN_CELL_SIZE = 12;

/**
 * Picks a per-cell pixel size so the whole board fits the viewport's
 * remaining space below (and beside) its on-screen position, shrinking or
 * growing `staticSize` up to `maxSize`. `heightPerUnit`/`widthPerUnit` are
 * the board's total pixel dimensions per 1px of cell size — `rows`/`cols`
 * for a square grid, a shape-dependent factor for hex's offset rows/cols —
 * since both board renderers' width/height formulas are linear in cell
 * size, this avoids needing per-shape layout math here.
 */
export default function useFitCellSize(containerRef, { heightPerUnit, widthPerUnit, staticSize, maxSize }) {
  const [size, setSize] = useState(staticSize);

  useEffect(() => {
    function recompute() {
      if (window.innerWidth < MOBILE_BREAKPOINT || !containerRef.current) {
        setSize(staticSize);
        return;
      }
      const top = containerRef.current.getBoundingClientRect().top;
      const availableHeight = window.innerHeight - top - VIEWPORT_MARGIN;
      const availableWidth = containerRef.current.clientWidth - VIEWPORT_MARGIN;
      const fitted = Math.min(availableHeight / heightPerUnit, availableWidth / widthPerUnit);
      setSize(Math.max(MIN_CELL_SIZE, Math.min(maxSize, Math.floor(fitted))));
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [containerRef, heightPerUnit, widthPerUnit, staticSize, maxSize]);

  return size;
}
