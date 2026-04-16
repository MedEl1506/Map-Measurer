import React, { useEffect, useMemo, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Circle } from "react-konva";

const UNIT_CONVERSIONS = {
  km: { label: "Kilometers (km)", mult: 1, suffix: "km", areaSuffix: "km²" },
  mi: { label: "Miles (mi)", mult: 0.621371, suffix: "mi", areaSuffix: "mi²" },
  yd: { label: "Yards (yd)", mult: 1093.61, suffix: "yd", areaSuffix: "yd²" },
  ft: { label: "Feet (ft)", mult: 3280.84, suffix: "ft", areaSuffix: "ft²" },
};

const TRAVEL_MODES = {
  foot: { label: "By foot", speedKmPerDay: 30 },
  horse: { label: "By horse", speedKmPerDay: 50 },
  ship: { label: "By ship", speedKmPerDay: 100 },
};

function computePolylineLengthKm(ptsKm) {
  if (ptsKm.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < ptsKm.length; i += 1) {
    const dx = ptsKm[i].x - ptsKm[i - 1].x;
    const dy = ptsKm[i].y - ptsKm[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

function computePolygonPerimeterKm(ptsKm) {
  if (ptsKm.length < 2) return 0;
  let total = computePolylineLengthKm(ptsKm);
  if (ptsKm.length >= 3) {
    const dx = ptsKm[0].x - ptsKm[ptsKm.length - 1].x;
    const dy = ptsKm[0].y - ptsKm[ptsKm.length - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

function computePolygonAreaKm2(ptsKm) {
  if (ptsKm.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ptsKm.length; i += 1) {
    const j = (i + 1) % ptsKm.length;
    sum += ptsKm[i].x * ptsKm[j].y - ptsKm[j].x * ptsKm[i].y;
  }
  return Math.abs(sum) / 2;
}

function getFitViewForImage(image, workspaceWidth, workspaceHeight) {
  if (!image || image.width <= 0 || image.height <= 0) {
    return { scale: 1, x: 0, y: 0 };
  }

  const scale = Math.min(workspaceWidth / image.width, workspaceHeight / image.height);
  const x = (workspaceWidth - image.width * scale) / 2;
  const y = (workspaceHeight - image.height * scale) / 2;

  return { scale, x, y };
}

function App() {
  const WORKSPACE_WIDTH = 1000;
  const WORKSPACE_HEIGHT = 620;

  const [imageUrl, setImageUrl] = useState(null);
  const [imgObj, setImgObj] = useState(null);
  const [mode, setMode] = useState("distance"); // "distance" | "area"
  const [points, setPoints] = useState([]); // [{x,y}, ...] in pixels
  const [isPolygonClosed, setIsPolygonClosed] = useState(false);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [isPanningWorkspace, setIsPanningWorkspace] = useState(false);
  const [isDragOverWorkspace, setIsDragOverWorkspace] = useState(false);
  const [viewScale, setViewScale] = useState(1);
  const [viewPosition, setViewPosition] = useState({ x: 0, y: 0 });
  const [displayUnit, setDisplayUnit] = useState("km");
  const [outputMode, setOutputMode] = useState("distance"); // "distance" | "travel"

  const [realWidthInput, setRealWidthInput] = useState("1000"); // km
  const [realHeightInput, setRealHeightInput] = useState("1000"); // km
  const [lockAspectRatio, setLockAspectRatio] = useState(false);
  const [lockedRatio, setLockedRatio] = useState(1);
  const [calibrationInput, setCalibrationInput] = useState("");
  const [calibrationError, setCalibrationError] = useState("");

  const realWidth = Number(realWidthInput);
  const realHeight = Number(realHeightInput);

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  useEffect(() => {
    if (points.length < 3 && isPolygonClosed) {
      setIsPolygonClosed(false);
    }
  }, [isPolygonClosed, points.length]);

  const loadImageFile = (file) => {
    if (!file) return;

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    const url = URL.createObjectURL(file);

    const img = new window.Image();
    img.src = url;
    img.onload = () => {
      const fitView = getFitViewForImage(img, WORKSPACE_WIDTH, WORKSPACE_HEIGHT);
      setImgObj(img);
      setImageUrl(url);
      setPoints([]);
      setIsPolygonClosed(false);
      setViewScale(fitView.scale);
      setViewPosition({ x: fitView.x, y: fitView.y });
    };
  };

  const handleUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    loadImageFile(file);
  };

  const scale = useMemo(() => {
    if (!imgObj || realWidth <= 0 || realHeight <= 0) return null;
    return {
      x: realWidth / imgObj.width,
      y: realHeight / imgObj.height,
    };
  }, [imgObj, realWidth, realHeight]);

  const pointsKm = useMemo(() => {
    if (!scale) return [];
    return points.map((p) => ({ x: p.x * scale.x, y: p.y * scale.y }));
  }, [points, scale]);

  const metrics = useMemo(() => {
    if (!scale) {
      return { lengthKm: null, areaKm2: null, perimeterKm: null };
    }

    if (mode === "distance") {
      return {
        lengthKm: computePolylineLengthKm(pointsKm),
        areaKm2: null,
        perimeterKm: null,
      };
    }

    if (mode === "area") {
      const canMeasureArea = isPolygonClosed && pointsKm.length >= 3;
      return {
        lengthKm: null,
        areaKm2: canMeasureArea ? computePolygonAreaKm2(pointsKm) : null,
        perimeterKm: canMeasureArea ? computePolygonPerimeterKm(pointsKm) : null,
      };
    }

    return { lengthKm: null, areaKm2: null, perimeterKm: null };
  }, [isPolygonClosed, mode, pointsKm, scale]);

  const handleClick = (e) => {  
    if (!imgObj) return;
    if (isDraggingNode) return;
    if (isPanningWorkspace) return;

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = transform.point(pointer);

    if (mode === "area" && isPolygonClosed) return;

    setPoints((prev) => [...prev, pos]);
  };

  const updatePoint = (index, next) => {
    setPoints((prev) => prev.map((p, i) => (i === index ? next : p)));
  };

  const clearShape = () => {
    setPoints([]);
    setIsPolygonClosed(false);
  };

  const undoLastPoint = () => {
    setPoints((prev) => {
      const next = prev.slice(0, -1);
      if (next.length < 3) setIsPolygonClosed(false);
      return next;
    });
  };

  const applyCalibration = () => {
    if (!scale) {
      setCalibrationError("Upload an image and set valid width/height first.");
      return;
    }

    const targetInput = Number(calibrationInput);
    if (Number.isNaN(targetInput) || targetInput <= 0) {
      setCalibrationError(
        mode === "distance"
          ? "Enter a valid known distance value."
          : "Enter a valid known area value."
      );
      return;
    }

    let targetKm = targetInput;
    if (mode === "distance") {
      targetKm = targetInput / UNIT_CONVERSIONS[displayUnit].mult;
    } else {
      targetKm = targetInput / Math.pow(UNIT_CONVERSIONS[displayUnit].mult, 2);
    }

    const currentValue = mode === "distance" ? metrics.lengthKm : metrics.areaKm2;
    if (currentValue == null || currentValue <= 0) {
      setCalibrationError(
        mode === "distance"
          ? "Draw at least 2 points to calibrate by distance."
          : "Close a polygon with at least 3 points to calibrate by area."
      );
      return;
    }

    const factor = mode === "distance" ? targetKm / currentValue : Math.sqrt(targetKm / currentValue);
    if (!Number.isFinite(factor) || factor <= 0) {
      setCalibrationError("Could not compute a valid scale factor.");
      return;
    }

    setRealWidthInput((prev) => (Number(prev) * factor).toFixed(6));
    setRealHeightInput((prev) => (Number(prev) * factor).toFixed(6));
    setCalibrationError("");
  };

  const handleWorkspaceDragOver = (e) => {
    e.preventDefault();
    if (!isDragOverWorkspace) {
      setIsDragOverWorkspace(true);
    }
  };

  const handleWorkspaceDragLeave = (e) => {
    e.preventDefault();
    setIsDragOverWorkspace(false);
  };

  const handleWorkspaceDrop = (e) => {
    e.preventDefault();
    setIsDragOverWorkspace(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith("image/")) {
      loadImageFile(file);
    }
  };

  const zoomAtPointer = (stage, nextScale) => {
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer || oldScale <= 0) return;

    const clampedScale = Math.max(0.05, Math.min(10, nextScale));
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const nextPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };

    setViewScale(clampedScale);
    setViewPosition(nextPos);
  };

  const handleWheelZoom = (e) => {
    e.evt.preventDefault();
    
    // Ignore standard scroll wheel events. Trackpad pinch-to-zoom sets ctrlKey=true.
    if (!e.evt.ctrlKey) return;

    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const zoomFactor = 1.08;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const nextScale = direction > 0 ? oldScale * zoomFactor : oldScale / zoomFactor;
    zoomAtPointer(stage, nextScale);
  };

  const zoomByFactor = (factor) => {
    const nextScale = viewScale * factor;
    setViewScale(Math.max(0.05, Math.min(10, nextScale)));
  };

  const fitImageToWorkspace = () => {
    if (!imgObj) return;
    const fitView = getFitViewForImage(imgObj, WORKSPACE_WIDTH, WORKSPACE_HEIGHT);
    setViewScale(fitView.scale);
    setViewPosition({ x: fitView.x, y: fitView.y });
  };

  const handleWidthChange = (nextWidthInput) => {
    setRealWidthInput(nextWidthInput);
    if (!lockAspectRatio) return;

    const nextWidth = Number(nextWidthInput);
    if (!Number.isFinite(nextWidth) || nextWidth <= 0 || lockedRatio <= 0) return;
    setRealHeightInput((nextWidth / lockedRatio).toFixed(6));
  };

  const handleHeightChange = (nextHeightInput) => {
    setRealHeightInput(nextHeightInput);
    if (!lockAspectRatio) return;

    const nextHeight = Number(nextHeightInput);
    if (!Number.isFinite(nextHeight) || nextHeight <= 0 || lockedRatio <= 0) return;
    setRealWidthInput((nextHeight * lockedRatio).toFixed(6));
  };

  const handleToggleAspectRatio = () => {
    if (!lockAspectRatio) {
      if (realWidth > 0 && realHeight > 0) {
        setLockedRatio(realWidth / realHeight);
      }
      setLockAspectRatio(true);
      return;
    }
    setLockAspectRatio(false);
  };

  return (
    <div
      style={{
        textAlign: "center",
        minHeight: "100vh",
        padding: 20,
        boxSizing: "border-box",
        background: "#f4f6f8",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          background: "#ffffff",
          borderRadius: 12,
          border: "1px solid #d0d7de",
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
          padding: 16,
        }}
      >
      <h2>Map Measurer</h2>

      <input type="file" accept="image/*" onChange={handleUpload} />

      <div style={{ display: "inline-flex", gap: 16, alignItems: "center", marginTop: 10 }}>
        <label>
          <input
            type="radio"
            name="mode"
            value="distance"
            checked={mode === "distance"}
            onChange={() => {
              setMode("distance");
              setIsPolygonClosed(false);
            }}
          />
          Distance
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            value="area"
            checked={mode === "area"}
            onChange={() => {
              setMode("area");
              setIsPolygonClosed(false);
            }}
          />
          Area
        </label>

        <div style={{ width: 1, height: 24, background: "#d0d7de", margin: "0 8px" }} />

        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          Display Unit:
          <select value={displayUnit} onChange={(e) => setDisplayUnit(e.target.value)}>
            {Object.entries(UNIT_CONVERSIONS).map(([key, data]) => (
              <option key={key} value={key}>{data.label}</option>
            ))}
          </select>
        </label>

        <label style={{ marginLeft: 12 }}>
          View:
          <select value={outputMode} onChange={(e) => setOutputMode(e.target.value)}>
            <option value="distance">Distance</option>
            <option value="travel">Travel time</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 10 }}>
        <span>
          Width (base km):{" "}
          <input
            type="number"
            min="0.000001"
            step="any"
            value={realWidthInput}
            onChange={(e) => {
              handleWidthChange(e.target.value);
            }}
            style={{ width: 120 }}
          />
        </span>
        <span>
          Height (base km):{" "}
          <input
            type="number"
            min="0.000001"
            step="any"
            value={realHeightInput}
            onChange={(e) => {
              handleHeightChange(e.target.value);
            }}
            style={{ width: 120 }}
          />
        </span>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={lockAspectRatio} onChange={handleToggleAspectRatio} />
          Lock ratio
        </label>
      </div>

      <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 10 }}>
        <button type="button" onClick={undoLastPoint} disabled={points.length === 0}>
          Undo point
        </button>
        <button type="button" onClick={clearShape} disabled={points.length === 0}>
          Clear
        </button>
        {mode === "area" && (
          <button
            type="button"
            onClick={() => setIsPolygonClosed((v) => !v)}
            disabled={points.length < 3}
          >
            {isPolygonClosed ? "Open polygon" : "Close polygon"}
          </button>
        )}
      </div>

      <p style={{ marginTop: 10 }}>
        {mode === "distance" &&
          "Click to add points for a path. Drag red nodes to adjust the path shape."}
        {mode === "area" &&
          "Click to add polygon nodes, then close the polygon to compute area. Drag red nodes to adjust the shape."}
      </p>

      <div style={{ marginTop: 10 }}>
        <strong>Calibrate from known value:</strong>{" "}
        <input
          type="number"
          min="0"
          value={calibrationInput}
          onChange={(e) => setCalibrationInput(e.target.value)}
          placeholder={mode === "distance" ? `Known distance (${UNIT_CONVERSIONS[displayUnit].suffix})` : `Known area (${UNIT_CONVERSIONS[displayUnit].areaSuffix})`}
          style={{ width: 220 }}
        />
        <button type="button" onClick={applyCalibration} style={{ marginLeft: 8 }}>
          Apply calibration
        </button>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
          {mode === "distance"
            ? "Uses the current drawn path length to set map scale."
            : "Uses the current closed polygon area to set map scale."}
        </div>
        {calibrationError && (
          <div style={{ color: "crimson", marginTop: 4, fontSize: 13 }}>{calibrationError}</div>
        )}
      </div>

      {mode === "distance" && metrics.lengthKm != null && (
        <div style={{ margin: "20px 0" }}>
          
          {outputMode === "distance" && (
            <h3>
              Total distance: {(metrics.lengthKm * UNIT_CONVERSIONS[displayUnit].mult).toFixed(2)}{" "}
              {UNIT_CONVERSIONS[displayUnit].suffix}
            </h3>
          )}

          {outputMode === "travel" && (
            <div>
              <h3>Travel time estimation</h3>

              {Object.entries(TRAVEL_MODES).map(([key, m]) => (
                <div key={key}>
                  <strong>{m.label}:</strong>{" "}
                  {(metrics.lengthKm / m.speedKmPerDay).toFixed(1)} days
                </div>
              ))}
            </div>
          )}

        </div>
      )}
      {mode === "area" && (
        <div style={{ margin: "20px 0" }}>
          {!scale ? (
            <div style={{ opacity: 0.8 }}>
              Enter valid positive width and height values to measure area.
            </div>
          ) : metrics.areaKm2 != null ? (
            <>
              <h3 style={{ margin: "0 0 10px 0" }}>
                Area: {(metrics.areaKm2 * Math.pow(UNIT_CONVERSIONS[displayUnit].mult, 2)).toFixed(2)} {UNIT_CONVERSIONS[displayUnit].areaSuffix}
              </h3>
              <div style={{ fontSize: 15 }}>
                Perimeter: {(metrics.perimeterKm * UNIT_CONVERSIONS[displayUnit].mult).toFixed(2)} {UNIT_CONVERSIONS[displayUnit].suffix}
              </div>
            </>
          ) : (
            <div style={{ opacity: 0.8 }}>
              {points.length < 3
                ? "Add at least 3 points to measure area."
                : "Close the polygon to measure area and perimeter."}
            </div>
          )}
        </div>
      )}

      <div
        onDragOver={handleWorkspaceDragOver}
        onDragLeave={handleWorkspaceDragLeave}
        onDrop={handleWorkspaceDrop}
        className="canvas-workspace"
        style={{
          width: WORKSPACE_WIDTH,
          height: WORKSPACE_HEIGHT,
          margin: "0 auto",
          border: isDragOverWorkspace ? "2px solid #2563eb" : "2px dashed #94a3b8",
          borderRadius: 10,
          background: isDragOverWorkspace ? "#eff6ff" : "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          cursor: imgObj ? (isPanningWorkspace ? "grabbing" : "grab") : "default",
          touchAction: "pan-x pan-y pinch-zoom",
          userSelect: "none",
        }}
      >
        {imgObj ? (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 2,
                display: "flex",
                gap: 6,
                background: "rgba(255,255,255,0.92)",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: 6,
              }}
            >
              <button type="button" onClick={() => zoomByFactor(0.9)}>
                -
              </button>
              <button type="button" onClick={() => zoomByFactor(1.1)}>
                +
              </button>
              <button type="button" onClick={fitImageToWorkspace}>
                Fit
              </button>
            </div>

            <Stage
              width={WORKSPACE_WIDTH}
              height={WORKSPACE_HEIGHT}
              x={viewPosition.x}
              y={viewPosition.y}
              scaleX={viewScale}
              scaleY={viewScale}
              onClick={handleClick}
              onWheel={handleWheelZoom}
              draggable
              onDragStart={() => setIsPanningWorkspace(true)}
              onDragMove={(evt) => {
                setViewPosition({ x: evt.target.x(), y: evt.target.y() });
              }}
              onDragEnd={(evt) => {
                setViewPosition({ x: evt.target.x(), y: evt.target.y() });
                setTimeout(() => setIsPanningWorkspace(false), 0);
              }}
              style={{ background: "#ffffff", touchAction: "pan-x pan-y pinch-zoom" }}
            >
              <Layer>
                <KonvaImage image={imgObj} />

                {points.length >= 2 && (
                  <Line
                    points={points.flatMap((p) => [p.x, p.y])}
                    stroke={mode === "distance" ? "blue" : "green"}
                    strokeWidth={2}
                    closed={mode === "area" && isPolygonClosed}
                    fill={mode === "area" && isPolygonClosed ? "rgba(0, 128, 0, 0.25)" : undefined}
                  />
                )}

                {points.map((p, i) => (
                  <Circle
                    key={i}
                    x={p.x}
                    y={p.y}
                    radius={6}
                    fill="red"
                    draggable
                    onDragStart={() => setIsDraggingNode(true)}
                    onDragEnd={(evt) => {
                      updatePoint(i, { x: evt.target.x(), y: evt.target.y() });
                      setTimeout(() => setIsDraggingNode(false), 0);
                    }}
                    onDragMove={(evt) => updatePoint(i, { x: evt.target.x(), y: evt.target.y() })}
                    onClick={() => {
                      if (mode === "area" && i === 0 && points.length >= 3) {
                        setIsPolygonClosed(true);
                      }
                    }}
                  />
                ))}
              </Layer>
            </Stage>
          </div>
        ) : (
          <div style={{ color: "#334155", fontSize: 16 }}>
            Drag and drop a map image here, or use the file picker above.
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default App;