import "./App.css";
import { baseAnimation } from "./pet/animation";
import { PetSlot } from "./pet/PetSlot";
import { layoutBounds, type Rect } from "./pet/layout";
import { getSpeciesDef } from "./pet/speciesRegistry";
import { canEvolve } from "./pet/petState";
import { StatusPanel } from "./ui/StatusPanel";
import { EvolutionFx } from "./ui/EvolutionFx";
import { ResizeOverlay } from "./ui/ResizeOverlay";
import { useAppState } from "./pet/useAppState";

function App() {
  const {
    appData,
    layout,
    sizes,
    oneShots,
    focusedSpeciesId,
    evolvingSpeciesId,
    resizing,
    showStatus,
    evoPhase,
    backgroundDrag,
    showMenu,
    handleDrop,
    handleDragLive,
    reportSize,
    clearOneShot,
    triggerHappy,
    commitSize,
    setResizing,
    MARGIN,
    PANEL_H,
  } = useAppState();

  if (!appData) return null;

  const rects: Rect[] = appData.slots
    .map((slot) => {
      const pos = layout.positions.find((p) => p.speciesId === slot.speciesId);
      const size = sizes[slot.speciesId];
      return pos && size ? { x: pos.x, y: pos.y, w: size.w, h: size.h } : null;
    })
    .filter((r): r is Rect => r !== null);
  const bounds = layoutBounds(rects);
  const originOffset = bounds ? { x: bounds.minX, y: bounds.minY } : { x: 0, y: 0 };

  const focusedPos = focusedSpeciesId ? layout.positions.find((p) => p.speciesId === focusedSpeciesId) : undefined;
  const focusedSize = focusedSpeciesId ? sizes[focusedSpeciesId] : undefined;
  const focusedAnchor =
    focusedPos && focusedSize
      ? { x: focusedPos.x - originOffset.x + MARGIN, y: focusedPos.y - originOffset.y + MARGIN, width: focusedSize.w }
      : null;

  return (
    <div
      onMouseDown={backgroundDrag.onMouseDown}
      onMouseMove={backgroundDrag.onMouseMove}
      onMouseUp={backgroundDrag.onMouseUp}
      className="relative h-screen w-screen bg-transparent"
      style={{ userSelect: "none", paddingTop: showStatus ? PANEL_H : 0 }}
    >
      {showStatus && focusedSpeciesId && appData.pets[focusedSpeciesId] && getSpeciesDef(focusedSpeciesId) && (
        <StatusPanel
          pet={appData.pets[focusedSpeciesId].instance}
          species={getSpeciesDef(focusedSpeciesId)!}
          anchor={focusedAnchor}
        />
      )}

      <EvolutionFx phase={evoPhase} />

      {appData.slots.map((slot) => {
        const progress = appData.pets[slot.speciesId];
        if (!progress) return null;
        const species = getSpeciesDef(slot.speciesId);
        const pos = layout.positions.find((p) => p.speciesId === slot.speciesId) ?? { x: 0, y: 0 };
        const base = baseAnimation(progress.instance.status.satiety);
        const evoReady = species
          ? canEvolve(species, progress.instance.form, progress.instance.exp) && evoPhase === "idle"
          : false;
        return (
          <PetSlot
            key={slot.speciesId}
            speciesId={slot.speciesId}
            form={slot.displayForm}
            base={base}
            oneShot={oneShots[slot.speciesId] ?? null}
            onOneShotEnd={() => clearOneShot(slot.speciesId)}
            position={pos}
            originOffset={originOffset}
            margin={MARGIN}
            evoPhase={slot.speciesId === evolvingSpeciesId ? evoPhase : "idle"}
            evoReady={evoReady}
            onSizeReady={(w, h) => reportSize(slot.speciesId, w, h)}
            onClick={() => triggerHappy(slot.speciesId)}
            onContextMenu={() => {
              if (!resizing) void showMenu(slot.speciesId);
            }}
            onDragLive={(dx, dy) => handleDragLive(slot.speciesId, dx, dy)}
            onDrop={(dx, dy) => handleDrop(slot.speciesId, dx, dy)}
          />
        );
      })}

      {resizing && (
        <ResizeOverlay
          onDone={(commit) => {
            if (commit) commitSize();
            else setResizing(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
