// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { PetSlot } from "./PetSlot";

vi.mock("./Pet", () => ({
  Pet: () => <div data-testid="pet-canvas-stub" />,
}));

vi.mock("./sheetImage", () => ({
  loadImage: () => Promise.resolve({} as HTMLImageElement),
  measureBounds: () => ({ minX: 0, minY: 0, maxX: 9, maxY: 9 }),
}));

vi.mock("./speciesFormAssets", () => ({
  speciesFormAsset: () => ({
    manifest: {
      id: "test/stage1",
      frameSize: 10,
      displayScale: 1,
      sheet: "sheet.png",
      columns: 1,
      animations: { idle: { frames: [0], fps: 1, loop: true } },
    },
    sheetUrl: "test://sheet.png",
  }),
}));

describe("PetSlot onContextMenu", () => {
  it("suppresses the native context menu and calls onContextMenu exactly once", async () => {
    const onContextMenu = vi.fn();
    const { container } = render(
      <PetSlot
        speciesId="test"
        form="stage1"
        base="idle"
        oneShot={null}
        onOneShotEnd={() => {}}
        position={{ x: 0, y: 0 }}
        originOffset={{ x: 0, y: 0 }}
        margin={0}
        evoPhase="idle"
        evoReady={false}
        onSizeReady={() => {}}
        onClick={() => {}}
        onContextMenu={onContextMenu}
        onDragLive={() => {}}
        onDrop={() => {}}
      />,
    );

    await waitFor(() => expect(container.firstElementChild).not.toBeNull());
    const wrapper = container.firstElementChild as HTMLElement;

    const notCancelled = fireEvent.contextMenu(wrapper);

    expect(notCancelled).toBe(false); // false = the event's default action was prevented
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });
});
