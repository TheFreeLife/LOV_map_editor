document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('map-canvas');
    const ctx = canvas.getContext('2d');
    const newTileModal = document.getElementById('new-tile-modal');
    const btnNewTile = document.getElementById('btn-new-tile');
    const btnCancelTile = document.getElementById('btn-cancel-tile');
    const btnCreateTile = document.getElementById('btn-create-tile');
    const toolsPalette = document.getElementById('tools-palette');
    const btnToolDraw = document.getElementById('btn-tool-draw');
    const btnToolFill = document.getElementById('btn-tool-fill');
    const btnToolErase = document.getElementById('btn-tool-erase'); // Added
    const btnToolPolygon = document.getElementById('btn-tool-polygon');
    const polygonShapeSelection = document.getElementById('polygon-shape-selection'); // Added
    const btnShapeRectangle = document.getElementById('btn-shape-rectangle');     // Added
    const btnShapeCircle = document.getElementById('btn-shape-circle');       // Added
    const btnLoad = document.getElementById('btn-load');
    const btnLoadPalette = document.getElementById('btn-load-palette');
    const fileLoader = document.getElementById('file-loader');
    const btnClearAll = document.getElementById('btn-clear-all'); // Added Clear All button
    const btnExportText = document.getElementById('btn-export-text'); // Added Export as Text button

    // Canvas resize elements
    const canvasWidthInput = document.getElementById('canvas-width');    // Added
    const canvasHeightInput = document.getElementById('canvas-height');  // Added
    const btnApplyCanvasSize = document.getElementById('btn-apply-canvas-size'); // Added

    // Context menu elements
    const tileContextMenu = document.getElementById('tile-context-menu');
    const contextMenuEdit = document.getElementById('context-menu-edit');
    const contextMenuDelete = document.getElementById('context-menu-delete');

    const TILE_SIZE = 32;
    let MAP_WIDTH = 800;
    let MAP_HEIGHT = 608;
    let MAP_COLS = MAP_WIDTH / TILE_SIZE;
    let MAP_ROWS = MAP_HEIGHT / TILE_SIZE;
    let mapData = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill(null));

    let currentTool = 'draw'; // 'draw' or 'fill'
    let currentShape = 'rectangle'; // 'rectangle' or 'circle' - for polygon tool

    // Visual zoom and pan variables (for the HTML canvas element itself)
    let visualScale = 1.0; // Controls CSS transform scale
    let visualOffsetX = 0; // Controls visual pan offset X
    let visualOffsetY = 0; // Controls visual pan offset Y
    const visualZoomFactor = 1.1; // How much to zoom in/out per scroll

    // Internal canvas rendering scale (always 1.0 in this model)
    const internalScale = 1.0; 

    // Pan variables (for mouse dragging)
    let isPanning = false;
    let lastClientX = 0;
    let lastClientY = 0;

    // Undo/Redo history
    const MAX_HISTORY_SIZE = 50; // Limit history to prevent excessive memory usage
    let history = [];
    let historyPointer = -1;

    // Tile editing state
    let isEditing = false;
    let editingTile = null;
    let contextMenuTargetTile = null; // Store tile that was right-clicked

    class Palette {
        constructor() {
            this.tiles = [];
            this.selectedTile = null;
        }

        clear() {
            this.tiles = [];
            this.selectedTile = null;
            this.render();
        }

        addTile(tile) {
            this.tiles.push(tile);
            this.render();
        }

        selectTile(tile) {
            this.selectedTile = tile;
            this.render();
        }

        deleteTile(tileToDelete) {
            if (confirm(`Are you sure you want to delete tile "${tileToDelete.name}"?`)) {
                this.tiles = this.tiles.filter(tile => tile !== tileToDelete);
                if (this.selectedTile === tileToDelete) {
                    this.selectedTile = null;
                }
                // Also remove this tile from mapData if it exists
                for (let row = 0; row < MAP_ROWS; row++) {
                    for (let col = 0; col < MAP_COLS; col++) {
                        if (mapData[row][col] === tileToDelete) {
                            mapData[row][col] = null;
                        }
                    }
                }
                this.render();
                redrawCanvas(); // Update canvas in case deleted tile was on map
                saveState();
            }
        }

        render() {
            toolsPalette.innerHTML = '';
            this.tiles.forEach(tile => {
                const tileEl = document.createElement('div');
                tileEl.className = 'tile-item';
                if (tile === this.selectedTile) {
                    tileEl.classList.add('selected');
                }
                tileEl.style.backgroundColor = tile.color;
                tileEl.textContent = tile.char;
                tileEl.title = tile.name;
                
                // Left-click to select tile
                tileEl.addEventListener('click', () => this.selectTile(tile));
                // Right-click to show context menu
                tileEl.addEventListener('contextmenu', (e) => showTileContextMenu(e, tile));
                
                toolsPalette.appendChild(tileEl);
            });
        }
    }

    const palette = new Palette();

    // Function to resize the canvas
    function resizeCanvas() {
        const newMAP_COLS = parseInt(canvasWidthInput.value);
        const newMAP_ROWS = parseInt(canvasHeightInput.value);

        if (isNaN(newMAP_COLS) || isNaN(newMAP_ROWS) || newMAP_COLS <= 0 || newMAP_ROWS <= 0) {
            alert(`Invalid dimensions. Please enter positive numbers for tile counts.`);
            canvasWidthInput.value = MAP_COLS;
            canvasHeightInput.value = MAP_ROWS;
            return;
        }

        const newWidth = newMAP_COLS * TILE_SIZE;
        const newHeight = newMAP_ROWS * TILE_SIZE;
        
        // Create new mapData array
        const newMapData = Array(newMAP_ROWS).fill(null).map(() => Array(newMAP_COLS).fill(null));

        // Copy existing mapData to the new mapData
        for (let row = 0; row < Math.min(MAP_ROWS, newMAP_ROWS); row++) {
            for (let col = 0; col < Math.min(MAP_COLS, newMAP_COLS); col++) {
                newMapData[row][col] = mapData[row][col];
            }
        }

        // Update global variables
        MAP_WIDTH = newWidth;
        MAP_HEIGHT = newHeight;
        MAP_COLS = newMAP_COLS;
        MAP_ROWS = newMAP_ROWS;
        mapData = newMapData;

        // Set canvas drawing buffer to new logical map dimensions
        canvas.width = MAP_WIDTH;
        canvas.height = MAP_HEIGHT;

        // Reset visual zoom and pan on canvas resize
        visualScale = 1.0;
        visualOffsetX = 0;
        visualOffsetY = 0;
        canvas.style.transformOrigin = '0 0'; // Top-left origin for transform
        canvas.style.transform = `scale(${visualScale}) translate(${visualOffsetX}px, ${visualOffsetY}px)`;

        redrawCanvas();
        saveState(); // Save state after resize
    }

    // Initialize canvas
    function setupCanvas() {
        // Set canvas drawing buffer to logical map dimensions
        canvas.width = MAP_WIDTH;
        canvas.height = MAP_HEIGHT;

        canvasWidthInput.value = MAP_COLS; // Initialize input with current tile count
        canvasHeightInput.value = MAP_ROWS; // Initialize input with current tile count

        // Ensure initial visual zoom/pan state is reset
        visualScale = 1.0;
        visualOffsetX = 0;
        visualOffsetY = 0;
        canvas.style.transformOrigin = '0 0'; // Top-left origin for transform
        canvas.style.transform = `scale(${visualScale}) translate(${visualOffsetX}px, ${visualOffsetY}px)`;

        redrawCanvas();
        saveState(); // Save initial state
    }

    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the entire canvas based on its current dimensions

        // No internal transform needed here, as visual scaling is handled by CSS transform on the element
        // And drawing happens at 1:1 scale on the internal resolution
        drawGrid();
        for (let row = 0; row < MAP_ROWS; row++) {
            for (let col = 0; col < MAP_COLS; col++) {
                const tile = mapData[row][col];
                if (tile) {
                    drawTile(col * TILE_SIZE, row * TILE_SIZE, tile);
                }
            }
        }
    }

    // Function to clear all tiles on the canvas
    function clearAllCanvas() {
        mapData = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill(null));
        redrawCanvas();
        saveState(); // Save state after clearing
    }

    // Function to export map data as text
    function exportMapAsText() {
        const exportedText = mapData.map(row =>
            row.map(tile => (tile ? tile.char : '.')).join('')
        );
        alert('Copy the following text:\n\n' + JSON.stringify(exportedText, null, 2));
    }

    // Draw grid lines
    function drawGrid() {
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 0.5 / internalScale; // Adjust line width based on internalScale (which is 1.0)

        for (let x = 0; x <= MAP_WIDTH; x += TILE_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, MAP_HEIGHT);
            ctx.stroke();
        }

        for (let y = 0; y <= MAP_HEIGHT; y += TILE_SIZE) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(MAP_WIDTH, y);
            ctx.stroke();
        }
    }

    function showModal() {
        newTileModal.style.display = 'block';
    }

    function hideModal() {
        newTileModal.style.display = 'none';
        isEditing = false;
        editingTile = null;
        btnCreateTile.textContent = 'Create Tile';
        // Reset form inputs
        document.getElementById('tile-name').value = '';
        document.getElementById('tile-char').value = '';
        document.getElementById('tile-color').value = '#ffffff';
    }

    function editTile(tile) {
        isEditing = true;
        editingTile = tile;
        document.getElementById('tile-name').value = tile.name;
        document.getElementById('tile-char').value = tile.char;
        document.getElementById('tile-color').value = tile.color;
        btnCreateTile.textContent = 'Update Tile';
        showModal();
    }

    function createTile() {
        const nameInput = document.getElementById('tile-name');
        const charInput = document.getElementById('tile-char');
        const colorInput = document.getElementById('tile-color');

        const name = nameInput.value;
        const char = charInput.value;
        const color = colorInput.value;

        if (name && char) {
            if (isEditing && editingTile) {
                editingTile.name = name;
                editingTile.char = char;
                editingTile.color = color;
                palette.render(); // Re-render palette to show changes
                redrawCanvas(); // Re-draw canvas to show color/char changes on map
            } else {
                palette.addTile({ name, char, color });
            }
            hideModal();
            saveState(); // Save state after create or edit
        } else {
            alert('Please fill in all fields.');
        }
    }

    function drawTile(x, y, tile) {
        ctx.fillStyle = tile.color;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        
        ctx.fillStyle = '#000';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tile.char, x + TILE_SIZE / 2, y + TILE_SIZE / 2);
    }

    function floodFill(startCol, startRow, fillTile) {
        const startTile = mapData[startRow][startCol];
        if (startTile === fillTile) {
            return;
        }

        const visited = new Set();
        const queue = [[startRow, startCol]];
        visited.add(`${startRow},${startCol}`);

        while (queue.length > 0) {
            const [row, col] = queue.shift();

            if (mapData[row][col] === startTile) {
                mapData[row][col] = fillTile;

                const neighbors = [[row + 1, col], [row - 1, col], [row, col + 1], [row, col - 1]];
                for (const [nRow, nCol] of neighbors) {
                    const key = `${nRow},${nCol}`;
                    if (nRow >= 0 && nRow < MAP_ROWS && nCol >= 0 && nCol < MAP_COLS && !visited.has(key)) {
                        queue.push([nRow, nCol]);
                        visited.add(key);
                    }
                }
            }
        }
        redrawCanvas();
        saveState(); // Save state after flood fill
    }

    function applyRectangleToMap(startCol, startRow, endCol, endRow, tile) {
        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);
        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);

        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
                    mapData[row][col] = tile;
                }
            }
        }
        saveState(); // Save state after applying rectangle
    }

    function applyCircleToMap(startCol, startRow, endCol, endRow, tile) {
        const centerX = startCol;
        const centerY = startRow;
        const radius = Math.round(Math.sqrt(Math.pow(endCol - centerX, 2) + Math.pow(endRow - centerY, 2)));

        if (radius <= 0) return;

        const setTile = (col, row) => {
            if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
                mapData[row][col] = tile;
            }
        };

        const rowsToFill = new Map(); // Map<row, {minCol, maxCol}>

        const plotPoint = (cx, cy, x, y) => {
            const points = [
                { col: cx + x, row: cy + y },
                { col: cx - x, row: cy + y },
                { col: cx + x, row: cy - y },
                { col: cx - x, row: cy - y },
                { col: cx + y, row: cy + x },
                { col: cx - y, row: cy + x },
                { col: cx + y, row: cy - x },
                { col: cx - y, row: cy - x },
            ];

            points.forEach(p => {
                const { col, row } = p;
                if (rowsToFill.has(row)) {
                    rowsToFill.get(row).minCol = Math.min(rowsToFill.get(row).minCol, col);
                    rowsToFill.get(row).maxCol = Math.max(rowsToFill.get(row).maxCol, col);
                } else {
                    rowsToFill.set(row, { minCol: col, maxCol: col });
                }
            });
        };

        let x = 0;
        let y = radius;
        let p = 3 - 2 * radius; // Decision parameter

        plotPoint(centerX, centerY, x, y);

        while (y >= x) {
            x++;
            if (p > 0) {
                y--;
                p = p + 4 * (x - y) + 10;
            } else {
                p = p + 4 * x + 6;
            }
            plotPoint(centerX, centerY, x, y);
        }

        // Fill the interior of the circle
        for (let [row, colRange] of rowsToFill.entries()) {
            for (let col = colRange.minCol; col <= colRange.maxCol; col++) {
                setTile(col, row);
            }
        }
        saveState(); // Save state after applying circle
    }


    let isDrawing = false;
    let startPoint = null; // Added for polygon tool

    function handleCanvasMouseDown(e) {
        // If right-click, start panning
        if (e.button === 2) { // Right mouse button
            isPanning = true;
            lastClientX = e.clientX;
            lastClientY = e.clientY;
            // Change cursor to indicate panning
            canvas.style.cursor = 'grabbing';
            return; // Don't process other tools if panning
        }

        // Only process drawing/tool logic if mouse is over the canvas element itself
        if (e.target !== canvas) return;

        // Existing logic for left-click tools
        if (!palette.selectedTile && currentTool !== 'erase') return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / visualScale;
        const y = (e.clientY - rect.top) / visualScale;

        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);

        if (currentTool === 'draw') {
            isDrawing = true;
            drawOnCanvas(x, y); // Pass transformed coordinates
        } else if (currentTool === 'fill') {
            if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
                floodFill(col, row, palette.selectedTile);
            }
        } else if (currentTool === 'erase') { // Added erase tool logic
            isDrawing = true;
            eraseOnCanvas(x, y); // Pass transformed coordinates
        } else if (currentTool === 'polygon') { // Added polygon tool logic
            isDrawing = true;
            startPoint = { col, row };
        }
    }

    function handleCanvasMouseMove(e) {
        if (isPanning) {
            const dx = e.clientX - lastClientX;
            const dy = e.clientY - lastClientY;

            visualOffsetX += dx;
            visualOffsetY += dy;

            lastClientX = e.clientX;
            lastClientY = e.clientY;
            
            // Apply updated visual offset to the canvas element
            canvas.style.transform = `translate(${visualOffsetX}px, ${visualOffsetY}px) scale(${visualScale})`;
            return; // Don't process other tools if panning
        }

        // Only process drawing/tool logic if mouse is over the canvas and drawing is active
        if (e.target !== canvas || !isDrawing) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / visualScale;
        const y = (e.clientY - rect.top) / visualScale;

        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);

        if (currentTool === 'draw' && palette.selectedTile) {
            drawOnCanvas(x, y); // Pass transformed coordinates
        } else if (currentTool === 'erase') {
            eraseOnCanvas(x, y); // Pass transformed coordinates
        } else if (currentTool === 'polygon' && startPoint) { // Preview for polygon tool
            redrawCanvas(); // Clear canvas and redraw existing map
            drawTemporaryShape(startPoint.col, startPoint.row, col, row);
        }
    }

    // Helper function to draw temporary shapes for preview
    function drawTemporaryShape(startCol, startRow, endCol, endRow) {
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2 / internalScale; // Adjust line width based on internalScale
        ctx.setLineDash([5 / internalScale, 5 / internalScale]); // Adjust dash based on internalScale

        const startX = startCol * TILE_SIZE;
        const startY = startRow * TILE_SIZE;
        const endX = endCol * TILE_SIZE;
        const endY = endRow * TILE_SIZE;

        if (currentShape === 'rectangle') {
            const width = endX - startX + TILE_SIZE;
            const height = endY - startY + TILE_SIZE;
            ctx.strokeRect(startX, startY, width, height);
        } else if (currentShape === 'circle') {
            const centerX = startCol * TILE_SIZE + TILE_SIZE / 2;
            const centerY = startRow * TILE_SIZE + TILE_SIZE / 2;

            const currentMouseX = endCol * TILE_SIZE + TILE_SIZE / 2;
            const currentMouseY = endRow * TILE_SIZE + TILE_SIZE / 2;

            const radius = Math.sqrt(Math.pow(currentMouseX - centerX, 2) + Math.pow(currentMouseY - centerY, 2));

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.setLineDash([]); // Reset line dash
    }


    function handleCanvasMouseUp(e) {
        if (isPanning) {
            isPanning = false;
            canvas.style.cursor = 'default'; // Reset cursor
            return;
        }

        // Only process drawing/tool logic if drawing is active
        if (!isDrawing) return;

        if (currentTool === 'polygon' && startPoint && palette.selectedTile) {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / visualScale;
            const y = (e.clientY - rect.top) / visualScale;
            const endCol = Math.floor(x / TILE_SIZE);
            const endRow = Math.floor(y / TILE_SIZE);

            if (currentShape === 'rectangle') {
                applyRectangleToMap(startPoint.col, startPoint.row, endCol, endRow, palette.selectedTile);
            } else if (currentShape === 'circle') {
                applyCircleToMap(startPoint.col, startPoint.row, endCol, endRow, palette.selectedTile);
            }
            redrawCanvas(); // Redraw canvas to show permanent shape
        }

        isDrawing = false;
        startPoint = null;
    }

    function handleCanvasMouseLeave() {
        // This function is still useful to reset drawing state if mouse leaves canvas
        // while a tool (not panning) is active.
        if (isDrawing && currentTool === 'polygon') {
            redrawCanvas(); // Clear temporary shape if polygon tool was active
        }
        isDrawing = false;
        startPoint = null;
    }

    function drawOnCanvas(x, y) {
        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);

        if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
            if (mapData[row][col] !== palette.selectedTile) {
                mapData[row][col] = palette.selectedTile;
                redrawCanvas();
                saveState(); // Save state after drawing
            }
        }
    }

    function eraseOnCanvas(x, y) { // Added eraseOnCanvas function
        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);

        if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
            if (mapData[row][col] !== null) { // Only erase if there's a tile
                mapData[row][col] = null;
                redrawCanvas();
                saveState(); // Save state after erasing
            }
        }
    }

    function selectTool(tool) {
        currentTool = tool;
        btnToolDraw.classList.toggle('selected', tool === 'draw');
        btnToolFill.classList.toggle('selected', tool === 'fill');
        btnToolErase.classList.toggle('selected', tool === 'erase');
        btnToolPolygon.classList.toggle('selected', tool === 'polygon');

        if (tool === 'polygon') {
            polygonShapeSelection.style.display = 'flex'; // Show shape selection
            selectShape(currentShape); // Ensure current shape is selected
        } else {
            polygonShapeSelection.style.display = 'none'; // Hide shape selection
        }
    }

    function selectShape(shape) {
        currentShape = shape;
        btnShapeRectangle.classList.toggle('selected', shape === 'rectangle');
        btnShapeCircle.classList.toggle('selected', shape === 'circle');
    }

    function loadTiles(e) {
        const file = e.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const newTiles = JSON.parse(event.target.result);
                palette.clear();
                newTiles.forEach(tile => palette.addTile(tile));
            } catch (error) {
                alert('Error parsing JSON file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    // Undo/Redo functions
    function saveState() {
        // If historyPointer is not at the end, clear future states
        if (historyPointer < history.length - 1) {
            history = history.slice(0, historyPointer + 1);
        }

        // Add current mapData to history
        history.push(JSON.parse(JSON.stringify(mapData)));
        historyPointer++;

        // Trim history if it exceeds MAX_HISTORY_SIZE
        if (history.length > MAX_HISTORY_SIZE) {
            history.shift(); // Remove the oldest state
            historyPointer--;
        }
    }

    function undo() {
        if (historyPointer > 0) {
            historyPointer--;
            mapData = JSON.parse(JSON.stringify(history[historyPointer]));
            redrawCanvas();
        }
    }

    function redo() {
        if (historyPointer < history.length - 1) {
            historyPointer++;
            mapData = JSON.parse(JSON.stringify(history[historyPointer]));
            redrawCanvas();
        }
    }

    function handleCanvasWheel(e) {
        e.preventDefault(); // Prevent page scrolling

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left; // Mouse position relative to canvas element
        const mouseY = e.clientY - rect.top;

        // Calculate the mouse position relative to the *transformed* canvas origin
        // This is needed to maintain the "point under cursor" during zoom
        const oldCanvasX = (mouseX - visualOffsetX) / visualScale;
        const oldCanvasY = (mouseY - visualOffsetY) / visualScale;

        let newVisualScale = visualScale;
        if (e.deltaY < 0) {
            newVisualScale *= visualZoomFactor; // Zoom in
        } else {
            newVisualScale /= visualZoomFactor; // Zoom out
        }

        // Clamp visualScale to reasonable limits (e.1 to 10)
        newVisualScale = Math.max(0.1, Math.min(newVisualScale, 10.0));

        // Calculate new offsets to keep the point under the mouse fixed
        visualOffsetX = mouseX - oldCanvasX * newVisualScale;
        visualOffsetY = mouseY - oldCanvasY * newVisualScale;

        visualScale = newVisualScale;
        canvas.style.transform = `translate(${visualOffsetX}px, ${visualOffsetY}px) scale(${visualScale})`;
    }

    // --- Custom Tile Context Menu Functions ---
    function showTileContextMenu(e, tile) {
        e.preventDefault(); // Prevent browser's default context menu
        contextMenuTargetTile = tile;
        tileContextMenu.style.left = `${e.clientX}px`;
        tileContextMenu.style.top = `${e.clientY}px`;
        tileContextMenu.style.display = 'block';
    }

    function hideTileContextMenu() {
        tileContextMenu.style.display = 'none';
        contextMenuTargetTile = null;
    }

    // Event Listeners
    btnNewTile.addEventListener('click', showModal);
    btnCancelTile.addEventListener('click', hideModal);
    btnCreateTile.addEventListener('click', createTile);
    
    // Change mouse event listeners from canvas to document for global interaction
    document.addEventListener('mousedown', handleCanvasMouseDown);
    document.addEventListener('mousemove', handleCanvasMouseMove);
    document.addEventListener('mouseup', handleCanvasMouseUp);
    document.addEventListener('wheel', handleCanvasWheel, { passive: false }); // Add wheel event listener to document
    // Removed canvas.addEventListener('mouseleave', handleCanvasMouseLeave); as mouseup on document handles state reset
    document.addEventListener('contextmenu', (e) => { // Prevent context menu globally for right-click panning
        if (e.button === 2 && e.target !== canvas && !e.target.closest('.tile-item')) { // Allow tile-item contextmenu
            e.preventDefault();
        }
    });

    // Hide context menu if clicking anywhere else
    document.addEventListener('mousedown', (e) => {
        if (!tileContextMenu.contains(e.target)) {
            hideTileContextMenu();
        }
    });

    // Listeners for custom context menu actions
    contextMenuEdit.addEventListener('click', () => {
        if (contextMenuTargetTile) {
            editTile(contextMenuTargetTile);
            hideTileContextMenu();
        }
    });
    contextMenuDelete.addEventListener('click', () => {
        if (contextMenuTargetTile) {
            palette.deleteTile(contextMenuTargetTile);
            hideTileContextMenu();
        }
    });


    // Keyboard event listeners for Undo/Redo
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault(); // Prevent browser's default undo
            undo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault(); // Prevent browser's default redo
            redo();
        }
    });

    btnToolDraw.addEventListener('click', () => selectTool('draw'));
    btnToolFill.addEventListener('click', () => selectTool('fill'));
    btnToolErase.addEventListener('click', () => selectTool('erase'));
    btnToolPolygon.addEventListener('click', () => selectTool('polygon')); // Event listener for polygon tool
    btnShapeRectangle.addEventListener('click', () => selectShape('rectangle')); // Event listener for rectangle shape
    btnShapeCircle.addEventListener('click', () => selectShape('circle'));     // Event listener for circle shape
    btnLoad.addEventListener('click', () => fileLoader.click());
    btnLoadPalette.addEventListener('click', () => fileLoader.click());
    fileLoader.addEventListener('change', (e) => loadTiles(e));
    btnApplyCanvasSize.addEventListener('click', resizeCanvas);
    btnClearAll.addEventListener('click', clearAllCanvas);
    btnExportText.addEventListener('click', exportMapAsText); // Added event listener for Clear All button


    // Initial setup
    setupCanvas();
    selectTool('draw'); // Default tool

    console.log("Map editor initialized.");
});