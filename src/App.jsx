import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiClock, FiRepeat, FiLogOut, FiCpu } from "react-icons/fi";
import Board from "./components/Board";
import HexBoard from "./components/HexBoard";
import Dice from "./components/Dice";
import TetrominoPreview from "./components/TetrominoPreview";
import HexPiecePreview from "./components/HexPiecePreview";
import HomeScreen from "./components/HomeScreen";
import ModeSelectScreen from "./components/ModeSelectScreen";
import SetupScreen from "./components/SetupScreen";
import BotSetupScreen from "./components/BotSetupScreen";
import OnlineModeScreen from "./components/online/OnlineModeScreen";
import GameOverScreen from "./components/GameOverScreen";
import GameTimer from "./components/GameTimer";
import HeaderControls from "./components/HeaderControls";
import TerrainLegend from "./components/TerrainLegend";
import useNickname from "./hooks/useNickname";
import { rollDice } from "./game/dice";
import {
  createInitialBoard,
  hasAnyValidPlacement,
  enumerateValidPlacements,
  isGameOver,
  isOutcomeDecided,
  hasMajorityShare,
  hasAnyPossibleMove,
  validPlacement,
  findPlayableDiceSizes,
  playerArea,
  rectCells,
} from "./game/rules";
import {
  pieceCells,
  rotationCount,
  isPiecePlayable,
  hasAnyPossibleTetrominoMove,
  createBag,
  drawFromBag,
  drawSmartPiece,
  packTetrominoesGreedy,
} from "./game/tetromino";
import { findEnclosedRegions } from "./game/enclosure";
import {
  dominoCells,
  dominoOrientationCount,
  validDominoPlacement,
  isDominoPlayable,
  hasAnyPossibleDominoMove,
  findPlayableDominoValues,
  rollDomino,
} from "./game/domino";
import {
  HEX_SHAPE_TYPES,
  hexShapeCells,
  hexShapeToOffsetCells,
  hexRotationCount,
  validHexPlacement,
  isHexShapePlayable,
  hasAnyPossibleHexMove,
  findPlayableHexShapes,
  hexNeighbors,
  packHexShapesGreedy,
} from "./game/hex";
import i18n from "./i18n";
import {
  LATE_GAME_FILL_THRESHOLD,
  FORCE_PLAYABLE_ROLL_AFTER,
  GAME_TITLE_PARTS,
  DOMINO_STORAGE_LIMIT,
  getCellSize,
  getHexSize,
  BASE_CELL_SIZE,
  BASE_HEX_SIZE,
} from "./game/constants";
import useFitCellSize from "./hooks/useFitCellSize";
import { contrastTextColor } from "./game/color";
import { detectNewEliminations, nextActivePlayerIndex } from "./game/elimination";
import {
  chooseDiceBotMove,
  chooseTetrominoBotMove,
  chooseDominoBotMove,
  chooseHexBotMove,
  chooseRouteBotMove,
  shouldBankDominoOnSkip,
} from "./game/bots";
import {
  createInitialRouteBoard,
  isValidRouteClaim,
  hasAnyPossibleRouteMove,
  isBridgeJumpClaim,
  makeRouteNeighborsFn,
  relocateBridge,
  shouldRelocateBridges,
  reviveEligiblePlayers,
  terrainLayersForRender,
  nextRollStreak,
} from "./game/route";

const ROLL_ANIMATION_MS = 650;
const BOT_MOVE_DELAY_MS = 600;

function makeGameState(gameType, config) {
  const { cols, rows, players, autoWin, allowRotation, doublesExtraTurn, smartAssist, autoFillEnclosed } = config;
  const base = {
    gameType,
    cols,
    rows,
    players,
    autoWin,
    allowRotation,
    doublesExtraTurn: gameType === "dice" && doublesExtraTurn,
    smartAssist,
    board: createInitialBoard(cols, rows, players),
    currentPlayerIndex: 0,
    turnPhase: "idle", // 'idle' | 'rolling' | 'placing' | 'skipped'
    rotationIndex: 0,
    lastRollWasDouble: false,
    log: [],
    startedAt: Date.now(),
    endedAt: null,
    endedReason: null, // 'exhausted' | 'decided' | 'majority'
    moveCount: 0,
    badRollStreak: 0,
    eliminatedPlayerIds: [],
  };
  if (gameType === "dice") return { ...base, dice: null, swapped: false };
  if (gameType === "tetromino") {
    return { ...base, bag: createBag(), pieceType: null, autoFillEnclosed: Boolean(autoFillEnclosed) };
  }
  if (gameType === "domino") {
    return { ...base, domino: null, storageByPlayer: Object.fromEntries(players.map((p) => [p.id, []])) };
  }
  if (gameType === "route") {
    return {
      ...base,
      allowRotation: false, // single-cell claims never rotate
      board: createInitialRouteBoard(cols, rows, players),
      routeRoll: null,
      piecesRemaining: 0,
      rollStreakByPlayer: Object.fromEntries(players.map((p) => [p.id, { streakValue: null, streakLength: 0 }])),
      pendingBonusTurn: false,
      turnsSinceBridgeMove: 0,
      autoFillEnclosed: Boolean(autoFillEnclosed),
    };
  }
  return {
    ...base,
    hexShapeIndex: null,
    hexCount: null,
    piecesRemaining: 0,
    activeSource: "roll", // 'roll' | 'stored' -- which shape the next click will place
    actedThisTurn: false,
    storageByPlayer: Object.fromEntries(players.map((p) => [p.id, null])),
    autoFillEnclosed: Boolean(autoFillEnclosed),
  };
}

function boardFillRatio(board) {
  const filled = board.pieces.reduce((sum, p) => sum + p.cells.length, 0);
  return filled / (board.cols * board.rows);
}

function isRollPlayable(board, playerId, d1, d2, allowRotation) {
  return allowRotation
    ? hasAnyValidPlacement(board, playerId, d1, d2)
    : enumerateValidPlacements(board, playerId, rectCells(0, 0, d1, d2)).length > 0;
}

/**
 * Rolls the dice, but once the board is mostly full and the player has
 * been unlucky a couple of rolls in a row, nudges the numbers toward a
 * pair that's actually placeable — not every roll, just often enough that
 * the endgame doesn't stall on pure chance. No-op if smart assist is off.
 */
function rollWeightedDice(board, playerId, badRollStreak, smartAssist, allowRotation) {
  const [d1, d2] = rollDice();

  if (!smartAssist || boardFillRatio(board) < LATE_GAME_FILL_THRESHOLD) {
    return { dice: [d1, d2], nextBadRollStreak: 0 };
  }
  if (isRollPlayable(board, playerId, d1, d2, allowRotation)) {
    return { dice: [d1, d2], nextBadRollStreak: 0 };
  }
  const streak = badRollStreak + 1;
  if (streak < FORCE_PLAYABLE_ROLL_AFTER) {
    return { dice: [d1, d2], nextBadRollStreak: streak };
  }
  const playable = findPlayableDiceSizes(board, playerId);
  if (playable.length === 0) {
    return { dice: [d1, d2], nextBadRollStreak: streak };
  }
  const forced = playable[Math.floor(Math.random() * playable.length)];
  return { dice: forced, nextBadRollStreak: 0 };
}

/**
 * Draws the next tetromino, but once the board is mostly full and the
 * player has been unlucky a couple of draws in a row, reorders the
 * *current* 7-bag toward a piece that's actually placeable — the bag's
 * fair composition is untouched, just reordered. No-op if smart assist
 * is off.
 */
function drawWeightedPiece(board, playerId, bag, badRollStreak, smartAssist, allowRotation) {
  const [naturalType, bagAfterDraw] = drawFromBag(bag);

  if (!smartAssist || boardFillRatio(board) < LATE_GAME_FILL_THRESHOLD) {
    return { type: naturalType, nextBag: bagAfterDraw, nextBadRollStreak: 0 };
  }

  const isPlaceable = (type) => isPiecePlayable(board, playerId, type, allowRotation);
  if (isPlaceable(naturalType)) {
    return { type: naturalType, nextBag: bagAfterDraw, nextBadRollStreak: 0 };
  }

  const streak = badRollStreak + 1;
  if (streak < FORCE_PLAYABLE_ROLL_AFTER) {
    return { type: naturalType, nextBag: bagAfterDraw, nextBadRollStreak: streak };
  }

  const queueBeforeDraw = [naturalType, ...bagAfterDraw];
  const [type, nextBag] = drawSmartPiece(queueBeforeDraw, isPlaceable);
  return { type, nextBag, nextBadRollStreak: isPlaceable(type) ? 0 : streak };
}

/**
 * Rolls a domino, but once the board is mostly full and the player has
 * been unlucky a couple of rolls in a row, nudges the values toward a pair
 * that's actually placeable — same weighting scheme as the dice/tetromino
 * draws. No-op if smart assist is off.
 */
function rollWeightedDomino(board, playerId, badRollStreak, smartAssist, allowRotation) {
  const [a, b] = rollDomino();

  if (!smartAssist || boardFillRatio(board) < LATE_GAME_FILL_THRESHOLD) {
    return { values: [a, b], nextBadRollStreak: 0 };
  }
  if (isDominoPlayable(board, playerId, [a, b], allowRotation)) {
    return { values: [a, b], nextBadRollStreak: 0 };
  }
  const streak = badRollStreak + 1;
  if (streak < FORCE_PLAYABLE_ROLL_AFTER) {
    return { values: [a, b], nextBadRollStreak: streak };
  }
  const playable = findPlayableDominoValues(board, playerId);
  if (playable.length === 0) {
    return { values: [a, b], nextBadRollStreak: streak };
  }
  const forced = playable[Math.floor(Math.random() * playable.length)];
  return { values: forced, nextBadRollStreak: 0 };
}

/**
 * Rolls a hex figure (one of HEX_SHAPE_TYPES) and a count (1-3), but once
 * the board is mostly full and the player has been unlucky a couple of
 * rolls in a row, nudges the *shape* toward one that's actually placeable —
 * same weighting scheme as the other games. The count is always fully
 * random: it doesn't affect whether the shape has anywhere to go, only how
 * many copies.
 */
function rollWeightedHexShape(board, playerId, badRollStreak, smartAssist, allowRotation) {
  const shapeIndex = HEX_SHAPE_TYPES[Math.floor(Math.random() * HEX_SHAPE_TYPES.length)];
  const count = 1 + Math.floor(Math.random() * 3);

  if (!smartAssist || boardFillRatio(board) < LATE_GAME_FILL_THRESHOLD) {
    return { shapeIndex, count, nextBadRollStreak: 0 };
  }
  if (isHexShapePlayable(board, playerId, shapeIndex, allowRotation)) {
    return { shapeIndex, count, nextBadRollStreak: 0 };
  }
  const streak = badRollStreak + 1;
  if (streak < FORCE_PLAYABLE_ROLL_AFTER) {
    return { shapeIndex, count, nextBadRollStreak: streak };
  }
  const playable = findPlayableHexShapes(board, playerId, allowRotation);
  if (playable.length === 0) {
    return { shapeIndex, count, nextBadRollStreak: streak };
  }
  const forced = playable[Math.floor(Math.random() * playable.length)];
  return { shapeIndex: forced, count, nextBadRollStreak: 0 };
}

/**
 * Reason an early (non-exhausted) end is warranted, or null if play should
 * continue. hasMajorityShare is only a *rigorous* guarantee for 2 players
 * (see its docstring in rules.js) — with 3+, a player can cross the T/P
 * share threshold while the remaining board is still large enough for a
 * single trailing player to catch up or overtake if it all concentrated in
 * their hands, so it's only trusted as a shortcut here for the 2-player
 * case. For 3+ players, isOutcomeDecided's flood-fill-backed check is the
 * only one that actually proves nobody else can still win.
 */
function checkAutoWin(board, players, neighborsFn, claimableTotal) {
  if (players.length === 2 && hasMajorityShare(board, players, claimableTotal)) return "majority";
  if (isOutcomeDecided(board, players, neighborsFn)) return "decided";
  return null;
}

/**
 * Tetritory's optional auto-fill: claims every pocket a player has fully
 * walled off with their own pieces, tiling each one with as many
 * tetrominoes as fit. Returns the (possibly unchanged) board plus one log
 * entry per claimed pocket.
 */
function applyAutoFillEnclosed(board, players) {
  const regions = findEnclosedRegions(board);
  let nextBoard = board;
  const entries = [];
  for (const region of regions) {
    const placements = packTetrominoesGreedy(region.cells);
    if (placements.length === 0) continue;
    const newPieces = placements.map((cells, i) => ({
      id: `${region.playerId}-autofill-${nextBoard.pieces.length + i}`,
      playerId: region.playerId,
      cells,
    }));
    nextBoard = { ...nextBoard, pieces: [...nextBoard.pieces, ...newPieces] };
    const player = players.find((p) => p.id === region.playerId);
    entries.push(
      i18n.t("playing.log.autoFillClaimed", {
        name: player?.name ?? region.playerId,
        count: placements.length * 4,
      })
    );
  }
  return { board: nextBoard, entries };
}

/** Hexoritory's version of applyAutoFillEnclosed: hex-neighbor regions, hex-shape packing. */
function applyAutoFillEnclosedHex(board, players) {
  const regions = findEnclosedRegions(board, hexNeighbors);
  let nextBoard = board;
  const entries = [];
  for (const region of regions) {
    const placements = packHexShapesGreedy(region.cells);
    if (placements.length === 0) continue;
    const newPieces = placements.map((cells, i) => ({
      id: `${region.playerId}-autofill-${nextBoard.pieces.length + i}`,
      playerId: region.playerId,
      cells,
    }));
    nextBoard = { ...nextBoard, pieces: [...nextBoard.pieces, ...newPieces] };
    const player = players.find((p) => p.id === region.playerId);
    const claimedCells = placements.reduce((sum, cells) => sum + cells.length, 0);
    entries.push(
      i18n.t("playing.log.autoFillClaimed", {
        name: player?.name ?? region.playerId,
        count: claimedCells,
      })
    );
  }
  return { board: nextBoard, entries };
}

/**
 * Routeritory's version of applyAutoFillEnclosed: terrain (river/mountain)
 * borders disqualify a region exactly like a second player's border would —
 * capture requires the region be walled off entirely by the claiming
 * player's own cells. Treating terrain as a neutral border here (as an
 * earlier version did) let the first player to touch the neutral island
 * auto-capture the rest of it for free, since an island's interior is
 * already fully bounded by river/mountain on every non-player side —
 * terrain "closing the loop" isn't the player's own encirclement. Since
 * every claim is always a single cell (no shape to pack), each enclosed
 * cell just becomes its own piece directly — same visual granularity as an
 * ordinary roll-and-claim turn.
 */
function applyAutoFillEnclosedRoute(board, players) {
  const regions = findEnclosedRegions(board);
  let nextBoard = board;
  const entries = [];
  for (const region of regions) {
    const newPieces = region.cells.map((cell, i) => ({
      id: `${region.playerId}-autofill-${nextBoard.pieces.length + i}`,
      playerId: region.playerId,
      cells: [cell],
    }));
    nextBoard = { ...nextBoard, pieces: [...nextBoard.pieces, ...newPieces] };
    const player = players.find((p) => p.id === region.playerId);
    entries.push(
      i18n.t("playing.log.autoFillClaimed", {
        name: player?.name ?? region.playerId,
        count: region.cells.length,
      })
    );
  }
  return { board: nextBoard, entries };
}

function cellsAnchor(cells) {
  return {
    x: Math.min(...cells.map((c) => c.x)),
    y: Math.min(...cells.map((c) => c.y)),
  };
}

export default function App() {
  const { t } = useTranslation();
  const [nickname, setNickname] = useNickname();
  // 'home' | 'mode' | 'setup' | 'botSetup' | 'online' | 'playing' | 'gameover'
  const [screen, setScreen] = useState("home");
  const [gameType, setGameType] = useState(null); // 'dice' | 'tetromino'
  const [mode, setMode] = useState(null); // 'hotseat' | 'bots' | 'online'
  const [game, setGame] = useState(null);
  const [hoverCell, setHoverCell] = useState(null);
  const rollTimeoutRef = useRef(null);
  const botTimeoutRef = useRef(null);

  useEffect(() => () => {
    clearTimeout(rollTimeoutRef.current);
    clearTimeout(botTimeoutRef.current);
  }, []);

  const board = game?.board ?? null;
  const boardWrapperRef = useRef(null);
  const isHexBoard = game?.gameType === "hex";
  const boardRows = board?.rows ?? 1;
  const boardCols = board?.cols ?? 1;
  const fittedCellSize = useFitCellSize(boardWrapperRef, isHexBoard
    ? {
        heightPerUnit: 1.5 * boardRows + 1,
        widthPerUnit: Math.sqrt(3) * (boardCols + 0.5),
        staticSize: getHexSize(boardRows),
        maxSize: Math.round(BASE_HEX_SIZE * 1.5),
      }
    : {
        heightPerUnit: boardRows,
        widthPerUnit: boardCols,
        staticSize: getCellSize(boardRows),
        maxSize: Math.round(BASE_CELL_SIZE * 1.5),
      });
  const players = game?.players ?? [];
  const currentPlayerIndex = game?.currentPlayerIndex ?? 0;
  const currentPlayer = players[currentPlayerIndex] ?? null;
  const dice = game?.dice ?? null;
  const swapped = game?.swapped ?? false;
  const pieceType = game?.pieceType ?? null;
  const domino = game?.domino ?? null;
  const storage = (currentPlayer && game?.gameType === "domino" && game?.storageByPlayer?.[currentPlayer.id]) ?? [];
  const hexShapeIndex = game?.hexShapeIndex ?? null;
  const hexCount = game?.hexCount ?? null;
  const piecesRemaining = game?.piecesRemaining ?? 0;
  const activeSource = game?.activeSource ?? "roll";
  const hexStorage =
    (currentPlayer && game?.gameType === "hex" && game?.storageByPlayer?.[currentPlayer.id]) ?? null;
  const hexActiveShapeIndex =
    game?.gameType === "hex" ? (activeSource === "roll" ? hexShapeIndex : hexStorage) : null;
  const rotationIndex = game?.rotationIndex ?? 0;
  const turnPhase = game?.turnPhase ?? "idle";
  const log = game?.log ?? [];
  const routeRoll = game?.routeRoll ?? null;

  const dims = dice ? (swapped ? { w: dice[1], h: dice[0] } : { w: dice[0], h: dice[1] }) : null;

  // Current shape — dice rectangle, tetromino piece, domino, or a hex figure
  // (the last normalized to a 0,0-ish axial origin instead of a bounding box).
  let shapeCells = null;
  let shapeKey = null;
  if (game?.gameType === "dice") {
    if (dims) {
      shapeCells = rectCells(0, 0, dims.w, dims.h);
      shapeKey = `${dice[0]},${dice[1]},${swapped}`;
    }
  } else if (game?.gameType === "tetromino") {
    if (pieceType) {
      shapeCells = pieceCells(pieceType, rotationIndex);
      shapeKey = `${pieceType},${rotationIndex}`;
    }
  } else if (domino) {
    shapeCells = dominoCells(domino.values, rotationIndex);
    shapeKey = `${domino.values[0]},${domino.values[1]},${rotationIndex}`;
  } else if (game?.gameType === "hex" && hexActiveShapeIndex != null) {
    shapeCells = hexShapeCells(hexActiveShapeIndex, rotationIndex);
    shapeKey = `${hexActiveShapeIndex},${rotationIndex},${activeSource}`;
  } else if (game?.gameType === "route") {
    shapeCells = [{ x: 0, y: 0 }];
    shapeKey = "route";
  }

  const previewPlacement = useMemo(() => {
    if (!board || !currentPlayer || currentPlayer.type === "bot" || turnPhase !== "placing" || !hoverCell || !shapeCells)
      return null;
    let cells;
    if (game.gameType === "hex") {
      cells = hexShapeToOffsetCells(shapeCells, hoverCell.x, hoverCell.y);
    } else {
      const boxW = Math.max(...shapeCells.map((c) => c.x)) + 1;
      const boxH = Math.max(...shapeCells.map((c) => c.y)) + 1;
      const ox = Math.max(0, Math.min(hoverCell.x, board.cols - boxW));
      const oy = Math.max(0, Math.min(hoverCell.y, board.rows - boxH));
      cells = shapeCells.map((c) => ({ ...c, x: c.x + ox, y: c.y + oy }));
    }
    const valid =
      game.gameType === "domino"
        ? validDominoPlacement(board, currentPlayer.id, cells)
        : game.gameType === "hex"
          ? validHexPlacement(board, currentPlayer.id, cells)
          : game.gameType === "route"
            ? isValidRouteClaim(board, currentPlayer.id, cells[0])
            : validPlacement(board, currentPlayer.id, cells);
    return { cells, valid };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shapeCells/game.gameType are derived from shapeKey above
  }, [board, turnPhase, hoverCell, shapeKey, currentPlayer?.id]);

  function handleSelectGame(id) {
    setGameType(id);
    setScreen("mode");
  }

  function handleSelectMode(selectedMode) {
    setMode(selectedMode);
    setScreen(selectedMode === "bots" ? "botSetup" : selectedMode === "online" ? "online" : "setup");
  }

  function handleStart(config) {
    setGame(makeGameState(gameType, config));
    setHoverCell(null);
    setScreen("playing");
  }

  function handleBackToSetup() {
    clearTimeout(rollTimeoutRef.current);
    clearTimeout(botTimeoutRef.current);
    setGame(null);
    setHoverCell(null);
    setScreen(mode === "bots" ? "botSetup" : mode === "online" ? "mode" : "setup");
  }

  function handleBackToMode() {
    clearTimeout(rollTimeoutRef.current);
    clearTimeout(botTimeoutRef.current);
    setGame(null);
    setMode(null);
    setHoverCell(null);
    setScreen("mode");
  }

  function handleBackToHome() {
    clearTimeout(rollTimeoutRef.current);
    clearTimeout(botTimeoutRef.current);
    setGame(null);
    setGameType(null);
    setMode(null);
    setHoverCell(null);
    setScreen("home");
  }

  function advanceTurn() {
    setGame((prev) => {
      const priorEliminated = prev.eliminatedPlayerIds ?? [];
      const currentEliminated = priorEliminated.includes(prev.players[prev.currentPlayerIndex].id);
      const keepSamePlayer =
        (prev.doublesExtraTurn && prev.lastRollWasDouble && !currentEliminated) ||
        (prev.gameType === "route" && prev.pendingBonusTurn && !currentEliminated);

      let nextBoard = prev.board;
      let turnsSinceBridgeMove = prev.turnsSinceBridgeMove;
      let eliminatedPlayerIds = priorEliminated;
      let revivedEntries = [];
      if (prev.gameType === "route") {
        turnsSinceBridgeMove = (prev.turnsSinceBridgeMove ?? 0) + 1;
        const activePlayerCount = prev.players.length - priorEliminated.length;
        if (shouldRelocateBridges(turnsSinceBridgeMove, activePlayerCount)) {
          const relocated = prev.board.bridges.map((bridge) =>
            relocateBridge(bridge, prev.board.bridgeCandidatesByArm, prev.board.bridges)
          );
          nextBoard = { ...prev.board, bridges: relocated };
          turnsSinceBridgeMove = 0;

          // Unlike every other game, elimination isn't permanent here: bridges
          // just moved, so a player boxed in a moment ago might have a fresh
          // crossing now — re-check everyone currently marked out.
          const { eliminatedPlayerIds: revivedIds, revived } = reviveEligiblePlayers(priorEliminated, nextBoard);
          eliminatedPlayerIds = revivedIds;
          revivedEntries = revived.map((id) => {
            const player = prev.players.find((p) => p.id === id);
            return i18n.t("playing.log.routeRevived", { name: player?.name ?? id });
          });
        }
      }

      return {
        ...prev,
        board: nextBoard,
        eliminatedPlayerIds,
        turnsSinceBridgeMove,
        pendingBonusTurn: false,
        currentPlayerIndex: keepSamePlayer
          ? prev.currentPlayerIndex
          : nextActivePlayerIndex(prev.players, prev.currentPlayerIndex, eliminatedPlayerIds),
        dice: null,
        swapped: false,
        pieceType: null,
        domino: null,
        hexShapeIndex: null,
        hexCount: null,
        routeRoll: null,
        piecesRemaining: 0,
        activeSource: "roll",
        actedThisTurn: false,
        rotationIndex: 0,
        turnPhase: "idle",
        lastRollWasDouble: false,
        log: revivedEntries.length ? [...revivedEntries.slice().reverse(), ...prev.log].slice(0, 40) : prev.log,
      };
    });
    setHoverCell(null);
  }

  function finishTurn({
    anyValid,
    entry,
    lastRollWasDouble,
    boardSnapshot,
    playersSnapshot,
    hasMoveFn,
    neighborsFn,
    claimableTotal,
    ...fields
  }) {
    setGame((prev) => ({
      ...prev,
      ...fields,
      turnPhase: anyValid ? "placing" : "skipped",
      lastRollWasDouble,
      log: [entry, ...prev.log].slice(0, 40),
      moveCount: prev.moveCount + 1,
    }));

    if (isGameOver(boardSnapshot, playersSnapshot, hasMoveFn)) {
      setGame((prev) => ({ ...prev, endedAt: Date.now(), endedReason: "exhausted" }));
      setScreen("gameover");
      return;
    }
    if (game.autoWin) {
      const autoWinReason = checkAutoWin(boardSnapshot, playersSnapshot, neighborsFn, claimableTotal);
      if (autoWinReason) {
        setGame((prev) => ({ ...prev, endedAt: Date.now(), endedReason: autoWinReason }));
        setScreen("gameover");
      }
    }
  }

  function handleRoll() {
    if (turnPhase !== "idle" || !currentPlayer || !board || !game) return;
    const rollingPlayer = currentPlayer;
    const boardSnapshot = board;
    const playersSnapshot = players;

    if (game.gameType === "dice") {
      const { dice: rolled, nextBadRollStreak } = rollWeightedDice(
        boardSnapshot,
        rollingPlayer.id,
        game.badRollStreak,
        game.smartAssist,
        game.allowRotation
      );
      const [d1, d2] = rolled;
      const isDouble = d1 === d2;

      setGame((prev) => ({ ...prev, turnPhase: "rolling", badRollStreak: nextBadRollStreak }));
      clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = setTimeout(() => {
        const anyValid = isRollPlayable(boardSnapshot, rollingPlayer.id, d1, d2, game.allowRotation);
        const doubleNote = isDouble && game.doublesExtraTurn ? i18n.t("playing.log.doubleNote") : "";
        const entry = anyValid
          ? i18n.t("playing.log.diceRoll", { name: rollingPlayer.name, d1, d2, doubleNote })
          : i18n.t("playing.log.diceRollSkipped", { name: rollingPlayer.name, d1, d2, doubleNote });

        finishTurn({
          dice: [d1, d2],
          swapped: false,
          anyValid,
          entry,
          lastRollWasDouble: isDouble,
          boardSnapshot,
          playersSnapshot,
        });
      }, ROLL_ANIMATION_MS);
    } else if (game.gameType === "tetromino") {
      const { type, nextBag, nextBadRollStreak } = drawWeightedPiece(
        boardSnapshot,
        rollingPlayer.id,
        game.bag,
        game.badRollStreak,
        game.smartAssist,
        game.allowRotation
      );

      setGame((prev) => ({ ...prev, turnPhase: "rolling", badRollStreak: nextBadRollStreak }));
      clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = setTimeout(() => {
        const anyValid = isPiecePlayable(boardSnapshot, rollingPlayer.id, type, game.allowRotation);
        const entry = anyValid
          ? i18n.t("playing.log.tetrominoRoll", { name: rollingPlayer.name, type })
          : i18n.t("playing.log.tetrominoRollSkipped", { name: rollingPlayer.name, type });

        finishTurn({
          pieceType: type,
          rotationIndex: 0,
          bag: nextBag,
          anyValid,
          entry,
          lastRollWasDouble: false,
          boardSnapshot,
          playersSnapshot,
          hasMoveFn: hasAnyPossibleTetrominoMove,
        });
      }, ROLL_ANIMATION_MS);
    } else if (game.gameType === "domino") {
      const { values, nextBadRollStreak } = rollWeightedDomino(
        boardSnapshot,
        rollingPlayer.id,
        game.badRollStreak,
        game.smartAssist,
        game.allowRotation
      );

      setGame((prev) => ({ ...prev, turnPhase: "rolling", badRollStreak: nextBadRollStreak }));
      clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = setTimeout(() => {
        const anyValid = isDominoPlayable(boardSnapshot, rollingPlayer.id, values, game.allowRotation);
        const entry = anyValid
          ? i18n.t("playing.log.dominoRoll", { name: rollingPlayer.name, a: values[0], b: values[1] })
          : i18n.t("playing.log.dominoRollSkipped", { name: rollingPlayer.name, a: values[0], b: values[1] });

        finishTurn({
          domino: { values, source: "roll", storageIndex: null },
          rotationIndex: 0,
          anyValid,
          entry,
          lastRollWasDouble: false,
          boardSnapshot,
          playersSnapshot,
          hasMoveFn: hasAnyPossibleDominoMove,
        });
      }, ROLL_ANIMATION_MS);
    } else if (game.gameType === "hex") {
      const { shapeIndex, count, nextBadRollStreak } = rollWeightedHexShape(
        boardSnapshot,
        rollingPlayer.id,
        game.badRollStreak,
        game.smartAssist,
        game.allowRotation
      );

      setGame((prev) => ({ ...prev, turnPhase: "rolling", badRollStreak: nextBadRollStreak }));
      clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = setTimeout(() => {
        const placeable = isHexShapePlayable(boardSnapshot, rollingPlayer.id, shapeIndex, game.allowRotation);
        const remaining = placeable ? count : 0;
        const label = i18n.t(`playing.hexShapeLabels.${shapeIndex}`);
        const entry = placeable
          ? i18n.t("playing.log.hexRoll", { name: rollingPlayer.name, shape: label, count })
          : i18n.t("playing.log.hexRollSkipped", { name: rollingPlayer.name, shape: label, count });

        finishTurn({
          hexShapeIndex: shapeIndex,
          hexCount: count,
          piecesRemaining: remaining,
          activeSource: "roll",
          rotationIndex: 0,
          actedThisTurn: false,
          anyValid: placeable,
          entry,
          lastRollWasDouble: false,
          boardSnapshot,
          playersSnapshot,
          hasMoveFn: hasAnyPossibleHexMove,
          neighborsFn: hexNeighbors,
        });
      }, ROLL_ANIMATION_MS);
    } else {
      // route
      const roll = 1 + Math.floor(Math.random() * 6);
      const streak = nextRollStreak(game.rollStreakByPlayer[rollingPlayer.id], roll);

      setGame((prev) => ({ ...prev, turnPhase: "rolling" }));
      clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = setTimeout(() => {
        const anyValid = hasAnyPossibleRouteMove(boardSnapshot, rollingPlayer.id);
        const entry = anyValid
          ? i18n.t("playing.log.routeRoll", { name: rollingPlayer.name, roll })
          : i18n.t("playing.log.routeRollSkipped", { name: rollingPlayer.name, roll });
        const bonusEntry = streak.bonus ? i18n.t("playing.log.routeStreakBonus", { name: rollingPlayer.name }) : null;

        finishTurn({
          routeRoll: roll,
          piecesRemaining: anyValid ? roll : 0,
          pendingBonusTurn: streak.bonus,
          rollStreakByPlayer: { ...game.rollStreakByPlayer, [rollingPlayer.id]: streak },
          anyValid,
          entry: bonusEntry ? `${entry} ${bonusEntry}` : entry,
          lastRollWasDouble: false,
          boardSnapshot,
          playersSnapshot,
          hasMoveFn: hasAnyPossibleRouteMove,
          neighborsFn: makeRouteNeighborsFn(boardSnapshot.bridges),
          claimableTotal: boardSnapshot.claimableTotal,
        });
      }, ROLL_ANIMATION_MS);
    }
  }

  function handlePickStorage(index) {
    if (turnPhase !== "idle" || game?.gameType !== "domino" || !currentPlayer || !board) return;
    const values = storage[index];
    if (!values) return;

    const anyValid = isDominoPlayable(board, currentPlayer.id, values, game.allowRotation);
    const entry = anyValid
      ? i18n.t("playing.log.dominoRollFromStorage", { name: currentPlayer.name, a: values[0], b: values[1] })
      : i18n.t("playing.log.dominoRollFromStorageSkipped", { name: currentPlayer.name, a: values[0], b: values[1] });

    setGame((prev) => ({
      ...prev,
      domino: { values, source: "storage", storageIndex: index },
      rotationIndex: 0,
      turnPhase: anyValid ? "placing" : "skipped",
      log: [entry, ...prev.log].slice(0, 40),
      moveCount: prev.moveCount + 1,
    }));
    setHoverCell(null);
  }

  function handleStore() {
    if (game?.gameType !== "domino" || !domino || domino.source !== "roll" || !currentPlayer) return;
    if (turnPhase !== "placing" && turnPhase !== "skipped") return;
    if (storage.length >= DOMINO_STORAGE_LIMIT) return;

    const entry = i18n.t("playing.log.dominoStored", { name: currentPlayer.name, a: domino.values[0], b: domino.values[1] });
    setGame((prev) => ({
      ...prev,
      storageByPlayer: {
        ...prev.storageByPlayer,
        [currentPlayer.id]: [...prev.storageByPlayer[currentPlayer.id], domino.values],
      },
      log: [entry, ...prev.log].slice(0, 40),
    }));
    advanceTurn();
  }

  /**
   * Places either the current rolled hex figure or the one pulled from
   * storage (`game.activeSource` says which). Placing a rolled figure ticks
   * down `piecesRemaining`; if the board is now too full for the *next*
   * copy of that same figure, the rest of the roll is auto-skipped in one
   * shot (the shape/board can't change further without another placement).
   * Placing the stored figure just clears the storage slot — it doesn't
   * count against the roll's `piecesRemaining` obligation.
   */
  function handleHexPlaceClick() {
    if (
      game?.gameType !== "hex" ||
      turnPhase !== "placing" ||
      !previewPlacement ||
      !previewPlacement.valid ||
      !currentPlayer ||
      !board
    )
      return;
    commitHexPlacement(previewPlacement.cells);
  }

  function commitHexPlacement(cells) {
    const source = game.activeSource;
    const shapeIndex = source === "roll" ? game.hexShapeIndex : game.storageByPlayer[currentPlayer.id];
    const piece = {
      id: `${currentPlayer.id}-${board.pieces.length}`,
      playerId: currentPlayer.id,
      cells,
    };
    const placedBoard = { ...board, pieces: [...board.pieces, piece] };
    const anchor = cellsAnchor(piece.cells);
    const label = i18n.t(`playing.hexShapeLabels.${shapeIndex}`);
    const logEntry =
      source === "roll"
        ? i18n.t("playing.log.hexPlaced", { name: currentPlayer.name, shape: label, x: anchor.x, y: anchor.y })
        : i18n.t("playing.log.hexPlacedFromStorage", { name: currentPlayer.name, shape: label, x: anchor.x, y: anchor.y });

    let nextPiecesRemaining = game.piecesRemaining;
    let nextStorageByPlayer = game.storageByPlayer;
    if (source === "roll") {
      nextPiecesRemaining = game.piecesRemaining - 1;
    } else {
      nextStorageByPlayer = { ...game.storageByPlayer, [currentPlayer.id]: null };
    }

    let skipNote = "";
    if (
      nextPiecesRemaining > 0 &&
      !isHexShapePlayable(placedBoard, currentPlayer.id, game.hexShapeIndex, game.allowRotation)
    ) {
      skipNote = i18n.t("playing.log.hexSkipRemainder", { count: nextPiecesRemaining });
      nextPiecesRemaining = 0;
    }

    const { board: newBoard, entries: autoFillEntries } = game.autoFillEnclosed
      ? applyAutoFillEnclosedHex(placedBoard, players)
      : { board: placedBoard, entries: [] };

    const { eliminatedPlayerIds, newlyEliminated } = detectNewEliminations(
      newBoard,
      players,
      hasAnyPossibleHexMove,
      game.eliminatedPlayerIds ?? []
    );
    const eliminationEntries = newlyEliminated.map((p) => i18n.t("playing.log.eliminated", { name: p.name }));

    setGame((prev) => ({
      ...prev,
      board: newBoard,
      storageByPlayer: nextStorageByPlayer,
      eliminatedPlayerIds,
      piecesRemaining: nextPiecesRemaining,
      activeSource: "roll",
      rotationIndex: 0,
      actedThisTurn: true,
      turnPhase: "placing",
      log: [
        ...eliminationEntries.slice().reverse(),
        ...autoFillEntries.slice().reverse(),
        logEntry + skipNote,
        ...prev.log,
      ].slice(0, 40),
    }));
    setHoverCell(null);

    if (isGameOver(newBoard, players, hasAnyPossibleHexMove)) {
      setGame((prev) => ({ ...prev, endedAt: Date.now(), endedReason: "exhausted" }));
      setScreen("gameover");
      return;
    }
    if (game.autoWin) {
      const autoWinReason = checkAutoWin(newBoard, players, hexNeighbors);
      if (autoWinReason) {
        setGame((prev) => ({ ...prev, endedAt: Date.now(), endedReason: autoWinReason }));
        setScreen("gameover");
        return;
      }
    }
    if (nextPiecesRemaining === 0) advanceTurn();
  }

  /**
   * Banks the current *rolled* figure instead of placing it (only one
   * figure at a time; only while the storage slot is empty). This still
   * counts toward the roll's obligation — it's an alternative to placing
   * that specific copy, not an extra action.
   */
  function handleStoreHex() {
    if (game?.gameType !== "hex" || !currentPlayer) return;
    if (turnPhase !== "placing" || game.activeSource !== "roll") return;
    if (game.storageByPlayer[currentPlayer.id] != null) return;

    const shapeIndex = game.hexShapeIndex;
    const nextPiecesRemaining = game.piecesRemaining - 1;
    const label = i18n.t(`playing.hexShapeLabels.${shapeIndex}`);
    const entry = i18n.t("playing.log.hexStored", { name: currentPlayer.name, shape: label });

    setGame((prev) => ({
      ...prev,
      storageByPlayer: { ...prev.storageByPlayer, [currentPlayer.id]: shapeIndex },
      piecesRemaining: nextPiecesRemaining,
      rotationIndex: 0,
      actedThisTurn: true,
      turnPhase: "placing",
      log: [entry, ...prev.log].slice(0, 40),
    }));
    setHoverCell(null);
    if (nextPiecesRemaining === 0) advanceTurn();
  }

  /**
   * Switches which figure the next board click will place: the one
   * pulled from storage, or back to whatever's left of the roll. This is a
   * bonus action, always optional — it never ends the turn by itself and
   * doesn't touch `piecesRemaining`.
   */
  function handleToggleStoredHex() {
    if (game?.gameType !== "hex" || !currentPlayer || !board) return;
    if (game.activeSource === "stored") {
      if (game.piecesRemaining <= 0) return;
      setGame((prev) => ({ ...prev, activeSource: "roll", rotationIndex: 0 }));
      setHoverCell(null);
      return;
    }
    if (turnPhase !== "placing" && turnPhase !== "skipped") return;
    const stored = game.storageByPlayer[currentPlayer.id];
    if (stored == null) return;
    if (!isHexShapePlayable(board, currentPlayer.id, stored, game.allowRotation)) return;
    setGame((prev) => ({ ...prev, activeSource: "stored", rotationIndex: 0, turnPhase: "placing" }));
    setHoverCell(null);
  }

  // Unified wrappers so the keyboard handler below (G / digit keys) can stay
  // game-agnostic: Dominotory has up to 4 storage slots to pick by number,
  // Hexoritory has a single slot toggled by "1".
  function handleStoreCurrent() {
    if (game?.gameType === "domino") handleStore();
    else if (game?.gameType === "hex") handleStoreHex();
  }

  function handlePickStorageOrToggle(index) {
    if (game?.gameType === "domino") handlePickStorage(index);
    else if (game?.gameType === "hex" && index === 0) handleToggleStoredHex();
  }

  function handleRotate() {
    if (!game?.allowRotation || turnPhase !== "placing") return;
    if (game.gameType === "dice") {
      if (!dice || dice[0] === dice[1]) return;
      setGame((prev) => ({ ...prev, swapped: !prev.swapped }));
    } else if (game.gameType === "tetromino") {
      if (!pieceType || rotationCount(pieceType) <= 1) return;
      setGame((prev) => ({ ...prev, rotationIndex: (prev.rotationIndex + 1) % rotationCount(pieceType) }));
    } else if (game.gameType === "domino") {
      if (!domino || dominoOrientationCount(domino.values) <= 1) return;
      setGame((prev) => ({
        ...prev,
        rotationIndex: (prev.rotationIndex + 1) % dominoOrientationCount(prev.domino.values),
      }));
    } else {
      if (hexActiveShapeIndex == null || hexRotationCount(hexActiveShapeIndex) <= 1) return;
      setGame((prev) => ({ ...prev, rotationIndex: (prev.rotationIndex + 1) % hexRotationCount(hexActiveShapeIndex) }));
    }
  }

  const keyActionsRef = useRef({});
  keyActionsRef.current = {
    handleRoll,
    advanceTurn,
    handleRotate,
    handleStore: handleStoreCurrent,
    handlePickStorage: handlePickStorageOrToggle,
    turnPhase,
  };

  useEffect(() => {
    function onKeyDown(event) {
      const tag = document.activeElement?.tagName;
      const isFormField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON";
      if (isFormField) return;

      const { handleRoll, advanceTurn, handleRotate, handleStore, handlePickStorage, turnPhase } = keyActionsRef.current;

      if (event.code === "Space") {
        if (turnPhase === "idle") {
          event.preventDefault();
          handleRoll();
        } else if (turnPhase === "skipped") {
          event.preventDefault();
          advanceTurn();
        }
        return;
      }

      if (event.code === "KeyR") {
        event.preventDefault();
        handleRotate();
        return;
      }

      if (event.code === "KeyG") {
        event.preventDefault();
        handleStore();
        return;
      }

      const digitMatch = event.code.match(/^Digit([1-4])$/);
      if (digitMatch) {
        event.preventDefault();
        handlePickStorage(Number(digitMatch[1]) - 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleHoverCell(x, y) {
    if (turnPhase !== "placing") return;
    setHoverCell({ x, y });
  }

  function handlePlaceClick() {
    if (turnPhase !== "placing" || !previewPlacement || !previewPlacement.valid || !currentPlayer || !board || !game) return;
    if (game.gameType === "route") {
      commitRoutePlacement(previewPlacement.cells[0]);
      return;
    }
    commitSquarePlacement(previewPlacement.cells);
  }

  function commitSquarePlacement(cells) {
    const piece = {
      id: `${currentPlayer.id}-${board.pieces.length}`,
      playerId: currentPlayer.id,
      cells,
    };
    const placedBoard = { ...board, pieces: [...board.pieces, piece] };
    const anchor = cellsAnchor(piece.cells);
    const placedW = Math.max(...cells.map((c) => c.x)) - Math.min(...cells.map((c) => c.x)) + 1;
    const placedH = Math.max(...cells.map((c) => c.y)) - Math.min(...cells.map((c) => c.y)) + 1;
    const logEntry =
      game.gameType === "dice"
        ? i18n.t("playing.log.dicePlaced", { name: currentPlayer.name, w: placedW, h: placedH, x: anchor.x, y: anchor.y })
        : game.gameType === "tetromino"
          ? i18n.t("playing.log.tetrominoPlaced", { name: currentPlayer.name, type: pieceType, x: anchor.x, y: anchor.y })
          : i18n.t("playing.log.dominoPlaced", {
              name: currentPlayer.name,
              a: domino.values[0],
              b: domino.values[1],
              x: anchor.x,
              y: anchor.y,
            });

    const { board: newBoard, entries: autoFillEntries } =
      game.gameType === "tetromino" && game.autoFillEnclosed
        ? applyAutoFillEnclosed(placedBoard, players)
        : { board: placedBoard, entries: [] };

    const hasMoveFn =
      game.gameType === "tetromino"
        ? hasAnyPossibleTetrominoMove
        : game.gameType === "domino"
          ? hasAnyPossibleDominoMove
          : hasAnyPossibleMove;
    const { eliminatedPlayerIds, newlyEliminated } = detectNewEliminations(
      newBoard,
      players,
      hasMoveFn,
      game.eliminatedPlayerIds ?? []
    );
    const eliminationEntries = newlyEliminated.map((p) => i18n.t("playing.log.eliminated", { name: p.name }));

    setGame((prev) => {
      const storageByPlayer =
        game.gameType === "domino" && domino.source === "storage"
          ? {
              ...prev.storageByPlayer,
              [currentPlayer.id]: prev.storageByPlayer[currentPlayer.id].filter((_, i) => i !== domino.storageIndex),
            }
          : prev.storageByPlayer;
      return {
        ...prev,
        board: newBoard,
        storageByPlayer,
        eliminatedPlayerIds,
        log: [...eliminationEntries.slice().reverse(), ...autoFillEntries.slice().reverse(), logEntry, ...prev.log].slice(
          0,
          40
        ),
      };
    });

    if (isGameOver(newBoard, players, hasMoveFn)) {
      setGame((prev) => ({ ...prev, endedAt: Date.now(), endedReason: "exhausted" }));
      setScreen("gameover");
      setHoverCell(null);
      return;
    }
    if (game.autoWin) {
      const autoWinReason = checkAutoWin(newBoard, players);
      if (autoWinReason) {
        setGame((prev) => ({ ...prev, endedAt: Date.now(), endedReason: autoWinReason }));
        setScreen("gameover");
        setHoverCell(null);
        return;
      }
    }
    advanceTurn();
  }

  /**
   * Claims a single cell. A bridge-crossing claim still costs the same 1
   * roll-point as any ordinary claim (see game/route.js) — the only thing
   * "free" about it is that the bridge cell itself is never separately
   * claimed as a stepping stone, so `piecesRemaining` always decrements by
   * exactly 1 here regardless of which kind of claim it was.
   */
  function commitRoutePlacement(cell) {
    const jumpBridge = isBridgeJumpClaim(board, currentPlayer.id, cell);
    const piece = {
      id: `${currentPlayer.id}-${board.pieces.length}`,
      playerId: currentPlayer.id,
      cells: [cell],
    };
    const placedBoard = { ...board, pieces: [...board.pieces, piece] };
    const logEntry = jumpBridge
      ? i18n.t("playing.log.routeBridgeCrossed", { name: currentPlayer.name, x: cell.x, y: cell.y })
      : i18n.t("playing.log.routePlaced", { name: currentPlayer.name, x: cell.x, y: cell.y });

    const nextPiecesRemaining = game.piecesRemaining - 1;

    const { board: newBoard, entries: autoFillEntries } = game.autoFillEnclosed
      ? applyAutoFillEnclosedRoute(placedBoard, players)
      : { board: placedBoard, entries: [] };

    const { eliminatedPlayerIds, newlyEliminated } = detectNewEliminations(
      newBoard,
      players,
      hasAnyPossibleRouteMove,
      game.eliminatedPlayerIds ?? []
    );
    const eliminationEntries = newlyEliminated.map((p) => i18n.t("playing.log.eliminated", { name: p.name }));

    setGame((prev) => ({
      ...prev,
      board: newBoard,
      eliminatedPlayerIds,
      piecesRemaining: nextPiecesRemaining,
      turnPhase: "placing",
      log: [
        ...eliminationEntries.slice().reverse(),
        ...autoFillEntries.slice().reverse(),
        logEntry,
        ...prev.log,
      ].slice(0, 40),
    }));
    setHoverCell(null);

    if (isGameOver(newBoard, players, hasAnyPossibleRouteMove)) {
      setGame((prev) => ({ ...prev, endedAt: Date.now(), endedReason: "exhausted" }));
      setScreen("gameover");
      return;
    }
    if (game.autoWin) {
      const autoWinReason = checkAutoWin(
        newBoard,
        players,
        makeRouteNeighborsFn(newBoard.bridges),
        newBoard.claimableTotal
      );
      if (autoWinReason) {
        setGame((prev) => ({ ...prev, endedAt: Date.now(), endedReason: autoWinReason }));
        setScreen("gameover");
        return;
      }
    }
    if (nextPiecesRemaining === 0) advanceTurn();
  }

  // Drives bot turns end-to-end: roll -> (after a short delay) decide + place -> advance.
  // Depends on the whole `game` object rather than hand-picked fields, same trade-off
  // `previewPlacement`'s memo above makes (see its eslint-disable comment) — this is also
  // what makes hex's multi-piece turns "just work" with no special-casing: after one copy
  // is placed, `turnPhase` stays "placing" but `game` is a new reference, so the effect
  // re-fires on its own for the next copy.
  useEffect(() => {
    if (screen !== "playing" || !game || !currentPlayer || currentPlayer.type !== "bot") return;

    if (game.turnPhase === "idle") {
      handleRoll();
      return;
    }

    if (game.turnPhase === "placing") {
      botTimeoutRef.current = setTimeout(() => {
        const opponents = players.filter(
          (p) => p.id !== currentPlayer.id && !(game.eliminatedPlayerIds ?? []).includes(p.id)
        );
        let cells = null;
        if (game.gameType === "dice") {
          cells = chooseDiceBotMove(board, currentPlayer.id, game.dice, game.allowRotation, currentPlayer.difficulty, opponents);
        } else if (game.gameType === "tetromino") {
          cells = chooseTetrominoBotMove(
            board,
            currentPlayer.id,
            game.pieceType,
            game.allowRotation,
            currentPlayer.difficulty,
            opponents
          );
        } else if (game.gameType === "domino") {
          cells = chooseDominoBotMove(
            board,
            currentPlayer.id,
            game.domino.values,
            game.allowRotation,
            currentPlayer.difficulty,
            opponents
          );
        } else if (game.gameType === "hex") {
          const activeShapeIndex = game.activeSource === "roll" ? game.hexShapeIndex : game.storageByPlayer[currentPlayer.id];
          cells = chooseHexBotMove(board, currentPlayer.id, activeShapeIndex, game.allowRotation, currentPlayer.difficulty, opponents);
        } else if (game.gameType === "route") {
          cells = chooseRouteBotMove(board, currentPlayer.id, currentPlayer.difficulty, opponents);
        }
        if (cells) {
          if (game.gameType === "hex") commitHexPlacement(cells);
          else if (game.gameType === "route") commitRoutePlacement(cells[0]);
          else commitSquarePlacement(cells);
        } else {
          advanceTurn();
        }
      }, BOT_MOVE_DELAY_MS);
      return () => clearTimeout(botTimeoutRef.current);
    }

    if (game.turnPhase === "skipped") {
      botTimeoutRef.current = setTimeout(() => {
        if (game.gameType === "domino" && shouldBankDominoOnSkip(currentPlayer.difficulty, storage.length, DOMINO_STORAGE_LIMIT)) {
          handleStore();
        } else {
          advanceTurn();
        }
      }, BOT_MOVE_DELAY_MS);
      return () => clearTimeout(botTimeoutRef.current);
    }
    // "rolling": nothing to do here, handleRoll's own rollTimeoutRef resolves it.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately scoped to `game` as a whole (see comment above)
  }, [screen, game, currentPlayer, board, players, storage]);

  if (screen === "home" || !gameType) {
    return <HomeScreen nickname={nickname} onNicknameChange={setNickname} onSelect={handleSelectGame} />;
  }

  if (screen === "mode") {
    return <ModeSelectScreen gameType={gameType} onSelect={handleSelectMode} onBack={handleBackToHome} />;
  }

  if (screen === "botSetup") {
    return (
      <BotSetupScreen gameType={gameType} firstPlayerName={nickname} onStart={handleStart} onBack={handleBackToMode} />
    );
  }

  if (screen === "online") {
    return (
      <OnlineModeScreen
        gameType={gameType}
        firstPlayerName={nickname}
        onBack={handleBackToMode}
        onGameStart={handleStart}
      />
    );
  }

  if (screen === "setup" || !game || !board) {
    return (
      <SetupScreen gameType={gameType} firstPlayerName={nickname} onStart={handleStart} onBack={handleBackToMode} />
    );
  }

  if (screen === "gameover") {
    return (
      <GameOverScreen
        board={board}
        players={players}
        gameType={game.gameType}
        startedAt={game.startedAt}
        endedAt={game.endedAt}
        moveCount={game.moveCount}
        reason={game.endedReason}
        onRestart={handleBackToSetup}
      />
    );
  }

  const canRotate =
    game.allowRotation &&
    turnPhase === "placing" &&
    (game.gameType === "dice"
      ? dice && dice[0] !== dice[1]
      : game.gameType === "tetromino"
        ? pieceType && rotationCount(pieceType) > 1
        : game.gameType === "domino"
          ? domino && dominoOrientationCount(domino.values) > 1
          : hexActiveShapeIndex != null && hexRotationCount(hexActiveShapeIndex) > 1);

  const canStoreDomino =
    game.gameType === "domino" &&
    domino?.source === "roll" &&
    storage.length < DOMINO_STORAGE_LIMIT &&
    (turnPhase === "placing" || turnPhase === "skipped");

  const canStoreHex =
    game.gameType === "hex" && activeSource === "roll" && piecesRemaining > 0 && turnPhase === "placing" && hexStorage == null;

  const canActivateStoredHex =
    game.gameType === "hex" &&
    hexStorage != null &&
    activeSource === "roll" &&
    (turnPhase === "placing" || turnPhase === "skipped");

  const canActivateRolledHex = game.gameType === "hex" && activeSource === "stored" && piecesRemaining > 0;

  const titleParts = GAME_TITLE_PARTS[gameType] ?? GAME_TITLE_PARTS.dice;
  const rollLabel = t(`playing.rollLabel.${game.gameType}`);
  const rollingLabel = t(`playing.rollingLabel.${game.gameType}`);
  const placingLabel =
    game.gameType === "hex"
      ? activeSource === "stored"
        ? t("playing.placingLabel.hexStored")
        : t("playing.placingLabel.hexRoll", { count: piecesRemaining })
      : t(`playing.placingLabel.${game.gameType}`);

  // The two halves shown side-by-side, ordered to match the current orientation
  // (mirrors how Diceritory's two dice swap display order with `swapped`).
  const dominoDisplay = domino
    ? dominoCells(domino.values, rotationIndex)
        .slice()
        .sort((a, b) => a.y - b.y || a.x - b.x)
    : null;

  return (
    <div className="min-h-screen bg-base-200 p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">
          <span className="text-primary">{titleParts[0]}</span>
          {titleParts[1]}
        </h1>
        <div className="flex items-center gap-3 text-sm text-base-content/70">
          <span title={t("playing.timerTitle")} className="flex items-center gap-1">
            <FiClock className="h-3.5 w-3.5" /> <GameTimer startedAt={game.startedAt} endedAt={game.endedAt} />
          </span>
          <span title={t("playing.movesTitle")} className="flex items-center gap-1">
            <FiRepeat className="h-3.5 w-3.5" /> {t("playing.moveLabel", { count: game.moveCount })}
          </span>
          <HeaderControls />
          <button className="btn btn-ghost btn-sm gap-1.5" onClick={handleBackToSetup}>
            <FiLogOut className="h-4 w-4" />
            {t("playing.exit")}
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="flex w-full flex-col gap-4 lg:w-72 lg:shrink-0">
          {/* Action button lives in its own block, always in the same spot. */}
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body p-4">
              <button
                className={
                  "btn btn-primary btn-sm " +
                  (turnPhase === "idle" || turnPhase === "skipped" ? "" : "invisible")
                }
                onClick={turnPhase === "skipped" ? advanceTurn : handleRoll}
                disabled={turnPhase !== "idle" && turnPhase !== "skipped"}
              >
                {turnPhase === "skipped" ? t("playing.nextButton") : rollLabel}
              </button>
            </div>
          </div>

          <div className="card bg-base-100 shadow-sm">
            <div className="card-body items-stretch gap-3 p-4">
              {game.gameType === "dice" ? (
                <div className="flex gap-3">
                  <Dice value={dims?.w ?? 1} rolling={turnPhase === "rolling"} />
                  <Dice value={dims?.h ?? 1} rolling={turnPhase === "rolling"} />
                </div>
              ) : game.gameType === "tetromino" ? (
                <TetrominoPreview
                  type={pieceType}
                  rotationIndex={rotationIndex}
                  rolling={turnPhase === "rolling"}
                  color={currentPlayer?.color}
                />
              ) : game.gameType === "domino" ? (
                <div className="flex gap-3">
                  <Dice value={dominoDisplay?.[0]?.value ?? 1} rolling={turnPhase === "rolling"} />
                  <Dice value={dominoDisplay?.[1]?.value ?? 1} rolling={turnPhase === "rolling"} />
                </div>
              ) : game.gameType === "hex" ? (
                <div className="flex items-center gap-3">
                  <HexPiecePreview
                    shapeIndex={hexActiveShapeIndex}
                    rotationIndex={rotationIndex}
                    rolling={turnPhase === "rolling"}
                    color={currentPlayer?.color}
                  />
                  {activeSource === "roll" && hexCount != null && (
                    <div className="flex items-center gap-2 text-sm text-base-content/70">
                      <Dice value={hexCount} rolling={turnPhase === "rolling"} />
                      <div className="text-xs text-base-content/50">
                        {t("playing.remainingLabel", { count: piecesRemaining })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Dice value={routeRoll ?? 1} rolling={turnPhase === "rolling"} />
                  {routeRoll != null && (
                    <div className="text-xs text-base-content/50">
                      {t("playing.remainingLabel", { count: piecesRemaining })}
                    </div>
                  )}
                </div>
              )}

              {canRotate && (
                <button className="btn btn-outline btn-sm" onClick={handleRotate}>
                  {t("playing.rotateButton")}
                </button>
              )}

              {canStoreDomino && (
                <button className="btn btn-outline btn-sm" onClick={handleStore}>
                  {t("playing.storeButton")}
                </button>
              )}

              {canStoreHex && (
                <button className="btn btn-outline btn-sm" onClick={handleStoreHex}>
                  {t("playing.storeButton")}
                </button>
              )}

              {canActivateStoredHex && (
                <button className="btn btn-outline btn-sm" onClick={handleToggleStoredHex}>
                  {t("playing.placeFromStorageButton")}
                </button>
              )}

              {canActivateRolledHex && (
                <button className="btn btn-outline btn-sm" onClick={handleToggleStoredHex}>
                  {t("playing.backToRollButton")}
                </button>
              )}

              {/* Reserved-height status block so surrounding layout never shifts. */}
              <div className="min-h-10 text-sm">
                {turnPhase === "rolling" && <p className="text-base-content/60">{rollingLabel}</p>}
                {turnPhase === "placing" && <p className="text-base-content/60">{placingLabel}</p>}
                {turnPhase === "skipped" && <p className="text-warning">{t("playing.skippedLabel")}</p>}
              </div>
            </div>
          </div>

          {game.gameType === "route" && <TerrainLegend />}

          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-2 p-4">
              <h2 className="card-title text-sm">{t("playing.historyTitle")}</h2>
              <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto text-xs text-base-content/70">
                {log.map((entry, i) => (
                  <li key={i}>{entry}</li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {players.map((player, index) => {
              const active = index === currentPlayerIndex;
              const eliminated = (game.eliminatedPlayerIds ?? []).includes(player.id);
              return (
                <div
                  key={player.id}
                  className={
                    "min-w-32 flex-1 rounded-lg border px-3 py-2 transition " +
                    (active
                      ? "border-transparent shadow-sm"
                      : eliminated
                        ? "border-base-300 bg-base-100 opacity-50"
                        : "border-base-300 bg-base-100")
                  }
                  style={active ? { background: player.color, color: contrastTextColor(player.color) } : undefined}
                >
                  <div className="flex items-center gap-2">
                    {!active && <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: player.color }} />}
                    {player.type === "bot" && <FiCpu className="h-3 w-3 shrink-0 opacity-70" title={t("mode.bots.title")} />}
                    <span className="truncate text-sm font-semibold">{player.name}</span>
                    {active && <span className="ml-auto shrink-0 text-xs font-medium opacity-80">{t("playing.turnBadge")}</span>}
                    {eliminated && (
                      <span className="ml-auto shrink-0 text-xs font-medium text-base-content/50">
                        {t("playing.eliminatedBadge")}
                      </span>
                    )}
                  </div>
                  <div className={"text-xs " + (active ? "opacity-90" : "text-base-content/60")}>
                    {t("playing.cellsCount", { count: playerArea(board, player.id) })}
                  </div>
                  {game.gameType === "domino" && (
                    <div className="mt-1.5 flex gap-1">
                      {Array.from({ length: DOMINO_STORAGE_LIMIT }, (_, i) => {
                        const values = game.storageByPlayer[player.id]?.[i];
                        const pickable = active && turnPhase === "idle" && Boolean(values);
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={!pickable}
                            onClick={() => handlePickStorage(i)}
                            title={pickable ? t("playing.pickFromStorageTitle", { n: i + 1 }) : undefined}
                            className={
                              "h-6 flex-1 rounded border font-mono text-[10px] transition " +
                              (active
                                ? pickable
                                  ? "cursor-pointer border-current/50 hover:bg-current/15"
                                  : "border-current/25 opacity-70"
                                : values
                                  ? "border-base-300 text-base-content/60"
                                  : "border-dashed border-base-300 text-base-content/25")
                            }
                          >
                            {values ? `${values[0]}:${values[1]}` : "—"}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {game.gameType === "hex" &&
                    (() => {
                      const stored = game.storageByPlayer[player.id];
                      const pickable =
                        active &&
                        stored != null &&
                        game.activeSource === "roll" &&
                        (turnPhase === "placing" || turnPhase === "skipped");
                      return (
                        <div className="mt-1.5">
                          <button
                            type="button"
                            disabled={!pickable}
                            onClick={() => handleToggleStoredHex()}
                            title={pickable ? t("playing.placeFromStorageTitle") : undefined}
                            className={
                              "h-6 w-full rounded border font-mono text-[10px] transition " +
                              (active
                                ? pickable
                                  ? "cursor-pointer border-current/50 hover:bg-current/15"
                                  : "border-current/25 opacity-70"
                                : stored != null
                                  ? "border-base-300 text-base-content/60"
                                  : "border-dashed border-base-300 text-base-content/25")
                            }
                          >
                            {stored != null ? t(`playing.hexShapeLabels.${stored}`) : "—"}
                          </button>
                        </div>
                      );
                    })()}
                </div>
              );
            })}
          </div>

          <div ref={boardWrapperRef} className="max-w-full overflow-x-auto rounded-lg border border-base-300 bg-base-100 p-2">
            {game.gameType === "hex" ? (
              <HexBoard
                board={board}
                players={players}
                previewPlacement={previewPlacement}
                previewColor={currentPlayer?.color}
                onHoverCell={handleHoverCell}
                onLeaveBoard={() => setHoverCell(null)}
                onPlaceClick={handleHexPlaceClick}
                interactive={currentPlayer?.type !== "bot"}
                hexSize={fittedCellSize}
              />
            ) : (
              <Board
                board={board}
                players={players}
                previewPlacement={previewPlacement}
                previewColor={currentPlayer?.color}
                previewPlayerId={currentPlayer?.id}
                onHoverCell={handleHoverCell}
                onLeaveBoard={() => setHoverCell(null)}
                onPlaceClick={handlePlaceClick}
                interactive={currentPlayer?.type !== "bot"}
                terrain={game.gameType === "route" ? terrainLayersForRender(board) : undefined}
                cellSize={fittedCellSize}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
